const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { execFileSync } = require('child_process');

const PROFILES = ['iniciante', 'avancado', 'inconsistente'];
const FLOWS = [
  { name: 'onboarding', pattern: '01 - onboarding' },
  { name: 'navigation', pattern: '08 - navigation stress' },
  { name: 'simulation', pattern: '09 - user simulation profile' },
  { name: 'errors', pattern: '10 - error resilience' },
  { name: 'abandonment', pattern: '11 - flow abandonment' },
];

const MAX_CYCLES = Math.max(1, Number(process.env.USER_SIM_MAX_CYCLES || 3));
const COOLDOWN_MS = Math.max(1000, Number(process.env.USER_SIM_COOLDOWN_MS || 4000));
const ARTIFACT = path.resolve(__dirname, '..', 'artifacts', 'user-simulation-loop.json');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveArtifact(payload) {
  fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
  fs.writeFileSync(ARTIFACT, JSON.stringify(payload, null, 2), 'utf-8');
}

function runStep(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: path.resolve(__dirname, '..'),
      env,
      shell: false,
      stdio: 'inherit',
    });

    child.on('close', (code) => resolve(Number(code || 0)));
    child.on('error', () => resolve(1));
  });
}

function getAdbPath() {
  const sdkRoot = process.env.ANDROID_SDK_ROOT
    || process.env.ANDROID_HOME
    || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');

  const adbExe = path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (fs.existsSync(adbExe)) {
    return adbExe;
  }

  return process.platform === 'win32' ? 'adb.exe' : 'adb';
}

function hasAttachedTarget() {
  try {
    const output = execFileSync(getAdbPath(), ['devices'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return String(output || '')
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .some((line) => /\sdevice$/.test(line));
  } catch {
    return false;
  }
}

async function main() {
  const report = {
    cycles: [],
    finishedAt: '',
    startedAt: new Date().toISOString(),
  };

  for (let cycle = 1; cycle <= MAX_CYCLES; cycle += 1) {
    const profile = PROFILES[(cycle - 1) % PROFILES.length];
    const flow = FLOWS[(cycle - 1) % FLOWS.length];

    const entry = {
      cycle,
      flow: flow.name,
      pattern: flow.pattern,
      profile,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    console.log(`[user-sim-loop] cycle=${cycle} profile=${profile} flow=${flow.name}`);

    if (!hasAttachedTarget()) {
      entry.finishedAt = new Date().toISOString();
      entry.status = 'skipped';
      entry.exitCode = 0;
      entry.reason = 'no_attached_target';
      report.cycles.push(entry);
      saveArtifact(report);
      console.log('[user-sim-loop] skipped: no attached Android target');
      await wait(COOLDOWN_MS);
      continue;
    }

    const code = await runStep(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/detox-bootstrap.ps1', '-Mode', 'attached', '-Run', 'test', '-TestPattern', flow.pattern],
      {
        ...process.env,
        DETOX_ALLOW_NO_TARGET: process.env.DETOX_ALLOW_NO_TARGET || '1',
        DETOX_ATTACHED_CONFIGURATION: process.env.DETOX_ATTACHED_CONFIGURATION || 'android.attached.debug',
        DETOX_REUSE_APP: process.env.DETOX_REUSE_APP || '1',
        QA_USER_PROFILE: profile,
        QA_SEED: `user-sim-${cycle}`,
      }
    );

    entry.finishedAt = new Date().toISOString();
    entry.status = code === 0 ? 'success' : 'failed';
    entry.exitCode = code;

    if (code !== 0) {
      console.log('[user-sim-loop] detox failed, running smoke fallback');
      const fallbackCode = await runStep('node', ['scripts/test-flow.js'], {
        ...process.env,
        BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:3000',
      });
      entry.fallback = {
        name: 'test-flow',
        exitCode: fallbackCode,
        status: fallbackCode === 0 ? 'success' : 'failed',
      };
    }

    report.cycles.push(entry);
    saveArtifact(report);

    await wait(COOLDOWN_MS);
  }

  report.finishedAt = new Date().toISOString();
  saveArtifact(report);
  console.log(`[user-sim-loop] finished cycles=${report.cycles.length}`);
}

main().catch((error) => {
  const fallback = {
    cycles: [],
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: 'failed',
    fatalError: String(error?.message || error || 'unknown_error'),
  };
  try {
    saveArtifact(fallback);
  } catch {
    // evita interromper por falha de escrita de artefato
  }
  console.error('[user-sim-loop] fatal', fallback.fatalError);
  process.exit(0);
});
