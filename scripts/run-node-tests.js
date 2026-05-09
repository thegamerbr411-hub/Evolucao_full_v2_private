const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEST_DIR = path.resolve(__dirname, '..', '__tests__');
const NODE_BIN = process.execPath;

function getTestFiles() {
  return fs.readdirSync(TEST_DIR)
    .filter((file) => file.endsWith('.mjs'))
    .sort();
}

function parseRequestedFiles(argv = []) {
  return argv
    .filter((arg) => typeof arg === 'string' && arg.trim())
    .filter((arg) => !arg.startsWith('--'))
    .map((arg) => path.basename(arg.trim()))
    .filter((file) => file.endsWith('.mjs'));
}

function resolveFilesToRun(argv = []) {
  const requested = parseRequestedFiles(argv);
  if (!requested.length) {
    return getTestFiles();
  }

  const available = new Set(getTestFiles());
  return requested.filter((file) => available.has(file));
}

function runFile(fileName) {
  return new Promise((resolve) => {
    const child = spawn(NODE_BIN, ['--no-warnings', path.join(TEST_DIR, fileName)], {
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
  const filesToRun = resolveFilesToRun(process.argv.slice(2));

  if (!filesToRun.length) {
    console.error('[test-runner] nenhum arquivo de teste valido foi selecionado');
    process.exit(1);
  }

  for (const fileName of filesToRun) {
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
