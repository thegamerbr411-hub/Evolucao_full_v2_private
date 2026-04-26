const fs = require('fs');
const path = require('path');

const {
  ROOT,
  ensureDir,
  listFilesRecursive,
  readJson,
  runCommand,
} = require('../core/shared');

function latestDetoxDir() {
  const detoxRoot = path.join(ROOT, 'artifacts', 'detox');
  if (!fs.existsSync(detoxRoot)) return null;
  const dirs = fs.readdirSync(detoxRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => path.join(detoxRoot, item.name));

  if (dirs.length === 0) return null;
  dirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0];
}

function copyDirShallow(srcDir, destDir) {
  ensureDir(destDir);
  for (const file of listFilesRecursive(srcDir)) {
    const rel = path.relative(srcDir, file);
    const out = path.join(destDir, rel);
    ensureDir(path.dirname(out));
    fs.copyFileSync(file, out);
  }
}

async function runCaptureTest({ config, testFile }) {
  const env = {
    ...process.env,
    DETOX_CONFIGURATION: config.detoxConfiguration,
    DETOX_TEST_FILE: testFile,
  };

  if (config.adbSerial) {
    env.DETOX_ADB_NAME = config.adbSerial;
  }

  const result = await runCommand(process.execPath, ['scripts/run-detox-cycle.js'], {
    cwd: ROOT,
    env,
    label: `capture:${testFile}`,
  });

  const cycleLast = readJson(path.join(ROOT, 'artifacts', 'detox-cycle-last.json'), {});
  return {
    testFile,
    exitCode: result.code,
    detox: cycleLast,
    finishedAt: new Date().toISOString(),
  };
}

async function captureEverything({ config, cycle, cycleDir }) {
  const captureDir = path.join(cycleDir, 'capture');
  ensureDir(captureDir);

  const runs = [];

  for (const testFile of config.captureTests) {
    const startedAt = new Date().toISOString();
    console.log(`[qa-loop] [ciclo ${cycle}] captura via ${testFile}`);
    const output = await runCaptureTest({ config, testFile });
    runs.push({
      ...output,
      startedAt,
    });

    if (output.exitCode !== 0) {
      throw new Error(`capture_failed:${testFile}`);
    }
  }

  const detoxDir = latestDetoxDir();
  const localDetoxMirror = detoxDir ? path.join(captureDir, 'detox-artifacts') : null;
  if (detoxDir && localDetoxMirror) {
    copyDirShallow(detoxDir, localDetoxMirror);
  }

  const allFiles = localDetoxMirror ? listFilesRecursive(localDetoxMirror) : [];
  const screenshots = allFiles.filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));

  const result = {
    cycle,
    runs,
    mirroredDetoxDir: localDetoxMirror,
    screenshotsCount: screenshots.length,
    finishedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(captureDir, 'capture-summary.json'), JSON.stringify(result, null, 2), 'utf-8');
  return result;
}

module.exports = {
  captureEverything,
};
