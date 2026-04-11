const { spawn } = require('child_process');

const argv = process.argv.slice(2);

function hasFlag(flag) {
  return argv.includes(flag);
}

function getArgValue(flag) {
  const index = argv.findIndex((item) => item === flag);
  if (index < 0 || index >= argv.length - 1) {
    return '';
  }
  return String(argv[index + 1] || '').trim();
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

const INTERVAL_MS = Math.max(1000, Number(process.env.NIGHT_RUN_INTERVAL_MS || 30000));
const RUN_ONCE = hasFlag('--once') || parseBoolean(process.env.NIGHT_RUN_ONCE, false);
const MAX_CYCLES = Math.max(0, Number(getArgValue('--max-cycles') || process.env.NIGHT_RUN_MAX_CYCLES || 0));

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(label, command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      shell: false,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve({ code: Number(code || 0), label });
    });

    child.on('error', (error) => {
      console.error(`[night-run] ${label} failed to start: ${error.message}`);
      resolve({ code: 1, label });
    });
  });
}

async function runCycle(index) {
  const startedAt = Date.now();
  console.log(`[night-run] cycle ${index} started at ${new Date(startedAt).toISOString()}`);

  const steps = [
    await runCommand('qa-smoke', 'node', ['scripts/test-flow.js']),
    await runCommand('qa-analyze', 'node', ['dashboard/scripts/ai-analyze.js']),
    await runCommand('detox-cycle', 'node', ['scripts/run-detox-cycle.js'], {
      env: {
        ...process.env,
        DETOX_ALLOW_NO_TARGET: process.env.DETOX_ALLOW_NO_TARGET || '1',
      },
    }),
  ];

  const durationMs = Date.now() - startedAt;
  const failed = steps.filter((step) => step.code !== 0);

  if (failed.length) {
    console.error(`[night-run] cycle ${index} finished with failures in ${durationMs}ms`);
    failed.forEach((step) => {
      console.error(`[night-run] ${step.label} exited with code ${step.code}`);
    });
  } else {
    console.log(`[night-run] cycle ${index} finished successfully in ${durationMs}ms`);
  }
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log('night-run usage: node dashboard/scripts/night-run.js [--once] [--max-cycles N]');
    console.log('env: NIGHT_RUN_ONCE=1 NIGHT_RUN_MAX_CYCLES=3 NIGHT_RUN_INTERVAL_MS=30000');
    process.exit(0);
  }

  let cycle = 1;

  do {
    await runCycle(cycle);
    cycle += 1;

    if (MAX_CYCLES > 0 && cycle > MAX_CYCLES) {
      break;
    }

    if (!RUN_ONCE) {
      console.log(`[night-run] waiting ${INTERVAL_MS}ms before next cycle`);
      await wait(INTERVAL_MS);
    }
  } while (!RUN_ONCE);
}

main().catch((error) => {
  console.error('[night-run] fatal', error.message);
  process.exit(1);
});
