const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEST_DIR = path.resolve(__dirname, '..', '__tests__');

function getTestFiles() {
  return fs.readdirSync(TEST_DIR)
    .filter((file) => file.endsWith('.mjs'))
    .sort();
}

function runFile(fileName) {
  return new Promise((resolve) => {
    const child = spawn('node', ['--no-warnings', path.join(TEST_DIR, fileName)], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => resolve({ code: Number(code || 0), fileName }));
    child.on('error', () => resolve({ code: 1, fileName }));
  });
}

async function main() {
  const failures = [];

  for (const fileName of getTestFiles()) {
    console.log(`[test-runner] ${fileName}`);
    const result = await runFile(fileName);
    if (result.code !== 0) {
      failures.push(result.fileName);
    }
  }

  if (failures.length) {
    console.error(`[test-runner] failed: ${failures.join(', ')}`);
    process.exit(1);
  }

  console.log('[test-runner] ok');
}

main().catch((error) => {
  console.error('[test-runner] fatal', error.message);
  process.exit(1);
});
