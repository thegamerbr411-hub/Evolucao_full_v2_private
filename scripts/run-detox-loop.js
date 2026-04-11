const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'artifacts');
const REPORT_FILE = path.join(ARTIFACTS_DIR, 'detox-loop-report.json');
const DEFAULT_PERSONA_SEQUENCE = ['iniciante', 'maromba', 'dieta'];

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPersonaSequence() {
  const raw = String(process.env.QA_PERSONA_SEQUENCE || '').trim();
  if (!raw) {
    return DEFAULT_PERSONA_SEQUENCE;
  }

  const parsed = raw.split(',').map((item) => item.trim()).filter(Boolean);
  return parsed.length ? parsed : DEFAULT_PERSONA_SEQUENCE;
}

function readReport() {
  try {
    return JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
  } catch {
    return {
      cycles: [],
      startedAt: new Date().toISOString(),
    };
  }
}

function writeReport(report) {
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
}

function runNodeScript(args, env) {
  return new Promise((resolve) => {
    const child = spawn('node', args, {
      cwd: path.resolve(__dirname, '..'),
      env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => resolve(Number(code || 0)));
    child.on('error', () => resolve(1));
  });
}

async function runCycle(env) {
  const exitCode = await runNodeScript(['scripts/run-detox-cycle.js'], env);
  const analyzeExitCode = await runNodeScript(['dashboard/scripts/ai-analyze.js'], env);
  return { analyzeExitCode, exitCode };
}

async function runFailureRetest(env) {
  const mode = String(process.env.QA_FAILURE_RETEST_MODE || 'smoke').trim().toLowerCase();
  if (mode === 'detox-cycle') {
    return runCycle(env);
  }

  const exitCode = await runNodeScript(['scripts/test-flow.js'], {
    ...env,
    BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:3000',
  });

  return {
    analyzeExitCode: await runNodeScript(['dashboard/scripts/ai-analyze.js'], env),
    exitCode,
  };
}

async function main() {
  ensureArtifactsDir();

  const startedAt = Date.now();
  const hours = Math.max(0, Number(process.env.QA_LOOP_HOURS || 8));
  const maxIterations = Math.max(0, Number(process.env.QA_LOOP_ITERATIONS || 0));
  const cooldownMs = Math.max(1000, Number(process.env.QA_LOOP_COOLDOWN_MS || 10000));
  const shouldRetestOnFailure = String(process.env.QA_LOOP_RETEST_ON_FAILURE || '1').trim() !== '0';
  const personaSequence = getPersonaSequence();
  const deadline = hours > 0 ? startedAt + (hours * 60 * 60 * 1000) : Number.POSITIVE_INFINITY;
  const report = readReport();

  let cycleIndex = 0;
  while (Date.now() < deadline) {
    if (maxIterations > 0 && cycleIndex >= maxIterations) {
      break;
    }

    const persona = personaSequence[cycleIndex % personaSequence.length];
    const seed = String(Date.now() + cycleIndex);
    const cycleStartedAt = Date.now();
    console.log(`[detox-loop] cycle=${cycleIndex + 1} persona=${persona} seed=${seed}`);

    const result = await runCycle({
      ...process.env,
      QA_PERSONA: persona,
      QA_SEED: seed,
    });

    const durationMs = Date.now() - cycleStartedAt;
    const cycleEntry = {
      analyzeExitCode: result.analyzeExitCode,
      cycle: cycleIndex + 1,
      durationMs,
      exitCode: result.exitCode,
      finishedAt: new Date().toISOString(),
      persona,
      seed,
      startedAt: new Date(cycleStartedAt).toISOString(),
    };

    if (result.exitCode !== 0 && shouldRetestOnFailure) {
      console.log('[detox-loop] cycle failed, running automatic retest');
      const retest = await runFailureRetest({
        ...process.env,
        QA_PERSONA: persona,
        QA_SEED: `${seed}-retest`,
      });
      cycleEntry.retest = {
        analyzeExitCode: retest.analyzeExitCode,
        exitCode: retest.exitCode,
        mode: String(process.env.QA_FAILURE_RETEST_MODE || 'smoke').trim().toLowerCase() || 'smoke',
      };
    }

    report.cycles.push(cycleEntry);
    writeReport(report);

    cycleIndex += 1;

    if (Date.now() >= deadline) {
      break;
    }

    console.log(`[detox-loop] cooldown ${cooldownMs}ms`);
    await sleep(cooldownMs);
  }

  console.log(`[detox-loop] finished after ${cycleIndex} cycle(s)`);
}

main().catch((error) => {
  console.error('[detox-loop] fatal', error.message);
  process.exit(1);
});
