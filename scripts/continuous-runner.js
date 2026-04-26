const { spawn } = require('child_process');

const MAX_CYCLES = Math.max(1, Number(process.env.CONTINUOUS_MAX_CYCLES || 3));

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: false,
      stdio: 'inherit',
    });

    child.on('close', (code) => resolve(Number(code || 0)));
    child.on('error', () => resolve(1));
  });
}

async function main() {
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle += 1) {
    console.log(`[continuous-runner] cycle=${cycle} start`);

    const brain = await run('node', ['scripts/ai-brain.js']);
    const growthReview = await run('node', ['scripts/growth-go-no-go.js']);
    const observability = await run('node', ['scripts/mobile-observability-baseline.js']);
    const testAll = await run('npm', ['run', 'test:all']);
    const dashboardTest = await run('npm', ['--prefix', 'dashboard', 'test']);

    const ok = brain === 0 && growthReview === 0 && observability === 0 && testAll === 0 && dashboardTest === 0;
    console.log(`[continuous-runner] cycle=${cycle} status=${ok ? 'ok' : 'degraded'}`);

    if (!ok) {
      process.exit(1);
    }
  }

  console.log('[continuous-runner] complete');
}

main().catch((error) => {
  console.error('[continuous-runner] fatal', error.message);
  process.exit(1);
});
