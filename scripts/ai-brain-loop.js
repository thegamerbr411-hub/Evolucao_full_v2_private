const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_CYCLES = Math.max(1, Number(process.env.AI_BRAIN_MAX_CYCLES || 3));
const DELAY_MS = Math.max(1000, Number(process.env.AI_BRAIN_DELAY_MS || 5000));
const REPORT_FILE = path.resolve(__dirname, '..', 'artifacts', 'ai-brain-loop.json');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, env = process.env) {
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

function save(report) {
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
}

async function main() {
  const report = {
    cycles: [],
    finishedAt: '',
    startedAt: new Date().toISOString(),
  };

  for (let cycle = 1; cycle <= MAX_CYCLES; cycle += 1) {
    const startedAt = new Date().toISOString();
    console.log(`[ai-brain-loop] cycle=${cycle} started`);

    const generatedCode = await run('node', ['scripts/ai-generate-tests.js']);
    const simulationCode = await run('node', ['scripts/user-simulation-loop.js'], {
      ...process.env,
      USER_SIM_MAX_CYCLES: process.env.USER_SIM_MAX_CYCLES || '1',
    });
    const analyzeCode = await run('node', ['dashboard/scripts/ai-analyze.js']);

    const entry = {
      analyzeCode,
      cycle,
      generatedCode,
      simulationCode,
      startedAt,
      status: (generatedCode === 0 && simulationCode === 0 && analyzeCode === 0) ? 'ok' : 'degraded',
    };

    report.cycles.push(entry);
    save(report);
    console.log(`[ai-brain-loop] cycle=${cycle} status=${entry.status}`);

    await wait(DELAY_MS);
  }

  report.finishedAt = new Date().toISOString();
  save(report);
  console.log('[ai-brain-loop] done');
}

main().catch((error) => {
  console.error('[ai-brain-loop] fatal', error.message);
  process.exit(1);
});
