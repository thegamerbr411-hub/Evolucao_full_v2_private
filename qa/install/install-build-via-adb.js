const path = require('path');

const { execCapture, writeJson } = require('../core/shared');

function getAdbBinary() {
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (!sdkRoot) return process.platform === 'win32' ? 'adb.exe' : 'adb';
  return process.platform === 'win32'
    ? path.join(sdkRoot, 'platform-tools', 'adb.exe')
    : path.join(sdkRoot, 'platform-tools', 'adb');
}

function parseDevices(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts[1] === 'device')
    .map((parts) => parts[0]);
}

function pickDevice(serial) {
  if (serial) return serial;
  const adb = getAdbBinary();
  const devicesOutput = execCapture(adb, ['devices'], { fallback: '' });
  const devices = parseDevices(devicesOutput);
  const physical = devices.find((item) => !String(item).startsWith('emulator-'));
  return physical || devices[0] || null;
}

function dumpsysPackage(adb, serial, packageName) {
  return execCapture(adb, ['-s', serial, 'shell', 'dumpsys', 'package', packageName], { fallback: '' });
}

function readLastUpdateTime(dumpsysOutput) {
  const match = String(dumpsysOutput || '').match(/lastUpdateTime=([^\r\n]+)/i);
  return match ? String(match[1]).trim() : '';
}

function readVersion(dumpsysOutput) {
  const versionName = (String(dumpsysOutput || '').match(/versionName=([^\r\n]+)/i) || [])[1] || '';
  const versionCode = (String(dumpsysOutput || '').match(/versionCode=([^\s\r\n]+)/i) || [])[1] || '';
  return {
    versionCode: String(versionCode).trim(),
    versionName: String(versionName).trim(),
  };
}

function packagePath(adb, serial, packageName) {
  const out = execCapture(adb, ['-s', serial, 'shell', 'pm', 'path', packageName], { fallback: '' });
  const firstLine = String(out || '').split(/\r?\n/).find((line) => line.includes('package:')) || '';
  return firstLine.replace('package:', '').trim();
}

function deviceApkSha256(adb, serial, remoteApkPath) {
  if (!remoteApkPath) return '';
  const direct = execCapture(adb, ['-s', serial, 'shell', 'sha256sum', remoteApkPath], { fallback: '' });
  const directHash = String(direct || '').trim().split(/\s+/)[0];
  if (/^[a-f0-9]{64}$/i.test(directHash)) return directHash;

  const toybox = execCapture(adb, ['-s', serial, 'shell', 'toybox', 'sha256sum', remoteApkPath], { fallback: '' });
  const toyboxHash = String(toybox || '').trim().split(/\s+/)[0];
  if (/^[a-f0-9]{64}$/i.test(toyboxHash)) return toyboxHash;

  return '';
}

function adbInstall(adb, serial, apkPath) {
  return execCapture(adb, ['-s', serial, 'install', '-r', '-d', '-g', apkPath], { fallback: '' });
}

async function installBuildViaAdb({ build, config, cycle, cycleDir }) {
  const adb = getAdbBinary();
  const serial = pickDevice(config.adbSerial);
  if (!serial) {
    throw new Error('adb_device_not_found');
  }

  const beforeDump = dumpsysPackage(adb, serial, config.androidPackage);
  const beforeUpdate = readLastUpdateTime(beforeDump);

  const installOutput = adbInstall(adb, serial, build.apkPath);
  if (!/success/i.test(String(installOutput || ''))) {
    throw new Error(`adb_install_failed:${String(installOutput || '').slice(0, 240)}`);
  }

  const afterDump = dumpsysPackage(adb, serial, config.androidPackage);
  const afterUpdate = readLastUpdateTime(afterDump);
  const versions = readVersion(afterDump);
  const remoteApkPath = packagePath(adb, serial, config.androidPackage);
  const remoteSha = deviceApkSha256(adb, serial, remoteApkPath);

  const hashMatches = remoteSha && String(remoteSha).toLowerCase() === String(build.apkSha256).toLowerCase();
  const installTimeChanged = beforeUpdate !== afterUpdate && Boolean(afterUpdate);

  if (!hashMatches && !installTimeChanged) {
    throw new Error('installed_build_validation_failed');
  }

  const result = {
    cycle,
    installedAt: new Date().toISOString(),
    adbSerial: serial,
    androidPackage: config.androidPackage,
    mainActivity: config.mainActivity,
    installOutput: String(installOutput || '').trim(),
    beforeUpdate,
    afterUpdate,
    remoteApkPath,
    remoteApkSha256: remoteSha || null,
    localApkSha256: build.apkSha256,
    hashMatches,
    installTimeChanged,
    versionName: versions.versionName,
    versionCode: versions.versionCode,
  };

  writeJson(path.join(cycleDir, 'build', 'install-report.json'), result);
  return result;
}

async function relaunchAppOnDevice({ config, install, cycle, cycleDir }) {
  const adb = getAdbBinary();
  const serial = install.adbSerial;

  execCapture(adb, ['-s', serial, 'shell', 'am', 'force-stop', config.androidPackage], { fallback: '' });

  const launchOutput = execCapture(adb, [
    '-s', serial,
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    `${config.androidPackage}/${config.mainActivity}`,
  ], { fallback: '' });

  if (!/status:\s*ok|complete/i.test(String(launchOutput || ''))) {
    throw new Error(`adb_relaunch_failed:${String(launchOutput || '').slice(0, 240)}`);
  }

  writeJson(path.join(cycleDir, 'build', 'relaunch-report.json'), {
    cycle,
    relaunchedAt: new Date().toISOString(),
    adbSerial: serial,
    launchOutput: String(launchOutput || '').trim(),
  });
}

module.exports = {
  installBuildViaAdb,
  relaunchAppOnDevice,
};
