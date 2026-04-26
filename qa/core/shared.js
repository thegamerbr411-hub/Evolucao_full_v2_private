const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function timestampId() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function listFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const out = [];
  for (const item of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function runCommand(command, args = [], options = {}) {
  const {
    cwd = ROOT,
    env = process.env,
    label = `${command} ${args.join(' ')}`,
  } = options;

  return new Promise((resolve) => {
    const startWithShellFallback = (reason) => {
      const commandLine = [command, ...args].join(' ');
      const fallback = spawn(commandLine, {
        cwd,
        env,
        shell: true,
        stdio: 'inherit',
      });

      fallback.on('close', (code) => {
        resolve({ code: Number(code || 0), label: `${label} (shell-fallback)` });
      });

      fallback.on('error', (fallbackError) => {
        console.error(`[qa-loop] falha no fallback shell: ${label}`, fallbackError?.message || fallbackError);
        resolve({
          code: 1,
          label,
          error: `${String(reason || 'spawn_failed')};fallback:${String(fallbackError?.message || fallbackError)}`,
        });
      });
    };

    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env,
        shell: false,
        stdio: 'inherit',
      });
    } catch (error) {
      const rawCode = String(error?.code || '').toUpperCase();
      const message = String(error?.message || error || 'unknown_error');
      if (process.platform === 'win32' && rawCode === 'EINVAL') {
        startWithShellFallback(`spawn:${message}`);
        return;
      }
      console.error(`[qa-loop] falha ao iniciar comando: ${label}`, message);
      resolve({ code: 1, label, error: message });
      return;
    }

    child.on('close', (code) => {
      resolve({ code: Number(code || 0), label });
    });

    child.on('error', (error) => {
      const rawCode = String(error?.code || '').toUpperCase();
      const message = String(error?.message || error || 'unknown_error');

      // Windows occasionally returns EINVAL when spawning .cmd wrappers.
      // Retry the same command through the shell as a resilient fallback.
      if (process.platform === 'win32' && rawCode === 'EINVAL') {
        startWithShellFallback(`spawn:${message}`);
        return;
      }

      console.error(`[qa-loop] falha ao iniciar comando: ${label}`, message);
      resolve({ code: 1, label, error: message });
    });
  });
}

function runShell(commandLine, options = {}) {
  const {
    cwd = ROOT,
    env = process.env,
    label = commandLine,
  } = options;

  return new Promise((resolve) => {
    const child = spawn(commandLine, {
      cwd,
      env,
      shell: true,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve({ code: Number(code || 0), label });
    });

    child.on('error', (error) => {
      console.error(`[qa-loop] falha ao iniciar shell: ${label}`, error?.message || error);
      resolve({ code: 1, label, error: String(error?.message || error) });
    });
  });
}

function execCapture(command, args = [], options = {}) {
  const {
    cwd = ROOT,
    env = process.env,
    fallback = '',
  } = options;

  try {
    return String(execFileSync(command, args, {
      cwd,
      env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }) || '');
  } catch {
    return fallback;
  }
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

module.exports = {
  ROOT,
  ensureDir,
  execCapture,
  getNpxCommand,
  listFilesRecursive,
  parseCsv,
  readJson,
  runCommand,
  runShell,
  sha256File,
  timestampId,
  writeJson,
};
