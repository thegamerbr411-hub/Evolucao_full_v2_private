const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGE_DIR = process.env.DETOX_APK_STAGE_DIR
  || (process.platform === 'win32' ? 'C:\\detox-bin' : '/tmp/detox-bin');

function parseConfig() {
  const arg = process.argv.find((item) => item.startsWith('--configuration='));
  const value = String((arg && arg.split('=')[1]) || 'debug').trim().toLowerCase();
  return value === 'release' ? 'release' : 'debug';
}

function ensureStageDir() {
  if (!fs.existsSync(STAGE_DIR)) {
    fs.mkdirSync(STAGE_DIR, { recursive: true });
  }
}

function copyFileOrFail(source, dest) {
  if (!fs.existsSync(source)) {
    throw new Error(`apk_source_not_found:${source}`);
  }
  fs.copyFileSync(source, dest);
}

function main() {
  ensureStageDir();

  const configuration = parseConfig();
  const isRelease = configuration === 'release';

  const appSource = isRelease
    ? path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
    : path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

  const testSource = isRelease
    ? path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'androidTest', 'release', 'app-release-androidTest.apk')
    : path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'androidTest', 'debug', 'app-debug-androidTest.apk');

  const appDest = path.join(STAGE_DIR, isRelease ? 'app-release.apk' : 'app-debug.apk');
  const testDest = path.join(STAGE_DIR, isRelease ? 'app-release-androidTest.apk' : 'app-debug-androidTest.apk');

  copyFileOrFail(appSource, appDest);
  copyFileOrFail(testSource, testDest);

  console.log(`[stage-detox-apks] configuration=${configuration}`);
  console.log(`[stage-detox-apks] app=${appDest}`);
  console.log(`[stage-detox-apks] test=${testDest}`);
}

try {
  main();
} catch (error) {
  console.error('[stage-detox-apks] fatal', String(error && error.message ? error.message : error));
  process.exit(1);
}
