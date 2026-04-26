const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUDIT_ROOT = path.join(ROOT, '_audit_release');

const TARGETS = [
  'src',
  'e2e',
  'backend',
  'dashboard',
  'App.js',
  'app.json',
  'babel.config.js',
  'index.js',
  'metro.config.js',
  'package.json',
  'README.md',
  '__tests__',
];

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function listFilesRecursive(basePath) {
  if (!exists(basePath)) {
    return [];
  }

  const stats = fs.statSync(basePath);
  if (stats.isFile()) {
    return [basePath];
  }

  const out = [];
  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(basePath, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
      continue;
    }
    out.push(full);
  }
  return out;
}

function readBytes(filePath) {
  return fs.readFileSync(filePath);
}

function areFilesEqual(fileA, fileB) {
  if (!exists(fileA) || !exists(fileB)) {
    return false;
  }

  const a = readBytes(fileA);
  const b = readBytes(fileB);
  if (a.length !== b.length) {
    return false;
  }
  return a.equals(b);
}

function toUnix(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function copyTarget(relativeTarget) {
  const source = path.join(ROOT, relativeTarget);
  const destination = path.join(AUDIT_ROOT, relativeTarget);

  if (!exists(source)) {
    return;
  }

  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    fs.rmSync(destination, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function buildDiff() {
  const drift = [];

  for (const relativeTarget of TARGETS) {
    const source = path.join(ROOT, relativeTarget);
    const destination = path.join(AUDIT_ROOT, relativeTarget);

    if (!exists(source) || !exists(destination)) {
      drift.push({ type: 'missing_target', target: toUnix(relativeTarget) });
      continue;
    }

    const sourceFiles = listFilesRecursive(source)
      .map((item) => path.relative(ROOT, item))
      .map(toUnix)
      .sort();

    const destinationFiles = listFilesRecursive(destination)
      .map((item) => path.relative(AUDIT_ROOT, item))
      .map(toUnix)
      .sort();

    for (const rel of sourceFiles) {
      const auditFile = path.join(AUDIT_ROOT, rel);
      const srcFile = path.join(ROOT, rel);
      if (!exists(auditFile)) {
        drift.push({ type: 'missing_in_audit', file: rel });
        continue;
      }
      if (!areFilesEqual(srcFile, auditFile)) {
        drift.push({ type: 'content_mismatch', file: rel });
      }
    }

    for (const rel of destinationFiles) {
      const srcFile = path.join(ROOT, rel);
      if (!exists(srcFile)) {
        drift.push({ type: 'extra_in_audit', file: rel });
      }
    }
  }

  return drift;
}

function writeReport(drift) {
  const qaDir = path.join(ROOT, 'qa');
  fs.mkdirSync(qaDir, { recursive: true });
  const outFile = path.join(qaDir, 'audit-release-sync-report.json');
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalDrift: drift.length,
        drift,
      },
      null,
      2
    ),
    'utf-8'
  );
  return outFile;
}

function main() {
  const mode = String(process.argv[2] || 'check').trim().toLowerCase();
  if (mode === 'sync') {
    for (const relativeTarget of TARGETS) {
      copyTarget(relativeTarget);
    }
  }

  const drift = buildDiff();
  const report = writeReport(drift);

  console.log('[audit-release-sync] mode=', mode);
  console.log('[audit-release-sync] drift=', drift.length);
  console.log('[audit-release-sync] report=', path.relative(ROOT, report).replace(/\\/g, '/'));

  if (drift.length > 0) {
    process.exit(1);
  }
}

main();
