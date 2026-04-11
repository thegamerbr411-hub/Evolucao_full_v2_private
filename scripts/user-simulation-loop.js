const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

    const code = await runStep(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/detox-bootstrap.ps1', '-Mode', 'attached', '-Run', 'test', '-TestPattern', flow.pattern],
      {
        ...process.env,
        DETOX_ATTACHED_CONFIGURATION: process.env.DETOX_ATTACHED_CONFIGURATION || 'android.attached.debug',
        QA_USER_PROFILE: profile,
        QA_SEED: `user-sim-${cycle}`,
      }
    );

    entry.finishedAt = new Date().toISOString();
    entry.status = code === 0 ? 'passed' : 'failed';
    entry.exitCode = code;
    report.cycles.push(entry);
    saveArtifact(report);

    await wait(COOLDOWN_MS);
  }

  report.finishedAt = new Date().toISOString();
  saveArtifact(report);
  console.log(`[user-sim-loop] finished cycles=${report.cycles.length}`);
}

main().catch((error) => {
  console.error('[user-sim-loop] fatal', error.message);
  process.exit(1);
});
