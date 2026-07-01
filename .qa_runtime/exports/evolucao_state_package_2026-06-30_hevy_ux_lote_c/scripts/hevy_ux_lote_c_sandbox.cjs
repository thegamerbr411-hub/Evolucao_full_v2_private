#!/usr/bin/env node
/** Hevy UX Lote C — sandbox visual QA on emulator-5554 (destructive allowed) */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADB = process.env.ADB_PATH || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const SERIAL = process.env.ANDROID_SERIAL || 'emulator-5554';
const PKG = 'com.tipolt.evolucaofullv2';
const ROOT = path.join(process.cwd(), '.qa_runtime/visual_audit/hevy_ux_lote_c');

const entries = [];

function adb(...args) {
  return execFileSync(ADB, ['-s', SERIAL, ...args], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
}
function sleep(ms) { execFileSync('powershell', ['-Command', `Start-Sleep -Milliseconds ${ms}`], { stdio: 'ignore' }); }
function keyevent(c) { adb('shell', 'input', 'keyevent', c); sleep(600); }
function tap(x, y) { adb('shell', 'input', 'tap', String(x), String(y)); sleep(900); }
function scrollDown() {
  adb('shell', 'input', 'swipe', '540', '1600', '540', '600', '400');
  sleep(1200);
}
function boundsCenter(t) {
  const m = String(t).match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  return m ? { x: Math.round((+m[1] + +m[3]) / 2), y: Math.round((+m[2] + +m[4]) / 2) } : null;
}
function uiDump() {
  sleep(450);
  const remote = `/sdcard/hulc_${Date.now()}.xml`;
  for (let i = 0; i < 3; i++) {
    try {
      adb('shell', 'uiautomator', 'dump', remote);
      sleep(200);
      const xml = adb('shell', 'cat', remote);
      if (xml.includes('<hierarchy')) return xml;
    } catch (e) {}
  }
  return '';
}
function pkg(xml) {
  const m = String(xml).match(/package="([^"]+)"/);
  return m ? m[1] : 'unknown';
}
function packageOk(xml) { return pkg(xml) === PKG; }
function findResourceBounds(xml, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`resource-id="[^"]*${esc}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'));
  return m ? boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`) : null;
}
function tapResource(id, xmlIn) {
  const xml = xmlIn || uiDump();
  const c = findResourceBounds(xml, id);
  if (!c) return false;
  tap(c.x, c.y);
  sleep(2500);
  return true;
}
function tapTextContains(substr, xmlIn) {
  const xml = xmlIn || uiDump();
  const esc = substr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`text="[^"]*${esc}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'));
  if (!m) return false;
  const c = boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`);
  tap(c.x, c.y);
  sleep(2500);
  return true;
}
function xmlHas(xml, token) {
  return String(xml || '').toLowerCase().includes(String(token || '').toLowerCase());
}
function capture(id, name, meta = {}) {
  fs.mkdirSync(ROOT, { recursive: true });
  const pngPath = path.join(ROOT, `${id}.png`);
  const xmlPath = path.join(ROOT, `${id}.xml`);
  const xml = meta.xml || uiDump();
  try {
    const buf = execFileSync(ADB, ['-s', SERIAL, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
    fs.writeFileSync(pngPath, buf);
  } catch (e) {
    adb('shell', 'screencap', '-p', '/sdcard/hulc_cap.png');
    adb('pull', '/sdcard/hulc_cap.png', pngPath);
  }
  fs.writeFileSync(xmlPath, xml, 'utf8');
  const entry = {
    id, name, device: SERIAL, package: pkg(xml), packageOk: packageOk(xml),
    action: meta.action || '', result: meta.result || '',
    checks: meta.checks || [], png: pngPath, xml: xmlPath, at: new Date().toISOString(),
  };
  entries.push(entry);
  console.log(JSON.stringify({ id, result: entry.result, packageOk: entry.packageOk }));
  return { xml, entry };
}
function wakeLaunch() {
  keyevent('KEYCODE_WAKEUP');
  adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
  sleep(3500);
}
function goTreinoTab(xml) {
  return tapResource('tab-treino', xml)
    || tapTextContains('Treino', xml);
}
function resumeWorkoutFromHome(xml) {
  return tapResource('btn_home_coach_cta', xml)
    || tapTextContains('Retomar treino', xml)
    || tapTextContains('CONTINUAR TREINO', xml);
}
function tryStartOrContinueWorkout(xml) {
  return resumeWorkoutFromHome(xml)
    || tapResource('btn-iniciar-treino', xml)
    || tapResource('btn_start_workout', xml)
    || tapTextContains('INICIAR TREINO', xml)
    || tapTextContains('CONTINUAR TREINO', xml)
    || tapTextContains('Iniciar treino', xml);
}
function trySaveActiveSets(maxAttempts = 12) {
  let saved = 0;
  for (let i = 0; i < maxAttempts; i += 1) {
    scrollDown();
    const xml = uiDump();
    if (tapResource('btn-save-set', xml)) {
      saved += 1;
      sleep(1200);
      continue;
    }
    if (tapTextContains('Salvar série', xml) || tapTextContains('Salvar serie', xml)) {
      saved += 1;
      sleep(1200);
    }
  }
  return saved;
}

function main() {
  console.log('SANDBOX_DESTRUCTIVE_ALLOWED_NOTE: emulator-5554 may finish workout and save QA data.');
  fs.mkdirSync(ROOT, { recursive: true });

  wakeLaunch();
  let xml = uiDump();
  capture('01_sandbox_home_or_treino_entry', 'Home or Treino entry', { xml, action: 'launch', result: packageOk(xml) ? 'APP_OPEN' : 'PACKAGE_MISMATCH' });

  goTreinoTab(xml);
  xml = uiDump();
  tryStartOrContinueWorkout(xml);
  xml = uiDump();
  if (!xmlHas(xml, 'screen-workout')) {
    goTreinoTab(xml);
    xml = uiDump();
    tryStartOrContinueWorkout(xml);
    xml = uiDump();
  }
  capture('02_sandbox_active_workout_before_finish', 'Active workout before finish', {
    xml,
    action: 'open_workout',
    result: xmlHas(xml, 'screen-workout') ? 'WORKOUT_SCREEN' : 'WORKOUT_UNCERTAIN',
  });

  trySaveActiveSets(16);
  for (let i = 0; i < 4; i += 1) scrollDown();
  xml = uiDump();

  const finishTapped = tapResource('btn-finalizar-treino', xml)
    || tapTextContains('Finalizar treino', xml)
    || tapTextContains('Finalizar', xml);
  xml = uiDump();
  capture('03_sandbox_finish_confirmation_or_action', 'Finish action', {
    xml,
    action: 'finish_tap',
    result: finishTapped ? 'FINISH_TAPPED' : 'FINISH_NOT_FOUND_MAY_BE_INCOMPLETE',
  });

  if (/series pendentes|treino em andamento|continuar treino/i.test(xml)) {
    tapTextContains('Continuar treino', xml);
    xml = uiDump();
  }

  sleep(2000);
  xml = uiDump();
  const summaryOk = xmlHas(xml, 'screen-workout-complete')
    || xmlHas(xml, 'workout-summary-card')
    || xmlHas(xml, 'Resumo do treino')
    || xmlHas(xml, 'Treino concluído');
  capture('04_sandbox_workout_summary', 'Workout summary screen', {
    xml,
    action: 'capture_summary',
    result: summaryOk ? 'SUMMARY_VISIBLE' : 'SUMMARY_NOT_DETECTED',
    checks: ['screen-workout-complete', 'workout-summary-card'],
  });

  scrollDown();
  xml = uiDump();
  capture('05_sandbox_summary_actions', 'Summary actions CTAs', {
    xml,
    action: 'scroll_actions',
    result: (xmlHas(xml, 'btn-workout-summary-history') || xmlHas(xml, 'Ver histórico')) ? 'CTAS_VISIBLE' : 'CTAS_UNCERTAIN',
  });

  tapResource('btn-workout-summary-history', xml) || tapTextContains('Ver histórico', xml);
  xml = uiDump();
  const historyOk = xmlHas(xml, 'Historico') || xmlHas(xml, 'history') || xmlHas(xml, 'histórico');
  capture('06_sandbox_history_after_summary', 'History after summary', { xml, action: 'history_nav', result: historyOk ? 'HISTORY_REACHED' : 'HISTORY_UNCERTAIN' });

  keyevent('KEYCODE_BACK');
  keyevent('KEYCODE_BACK');
  xml = uiDump();
  capture('07_sandbox_back_navigation', 'Back navigation', { xml, action: 'back', result: packageOk(xml) ? 'NAV_OK' : 'NAV_UNCERTAIN' });

  const manifest = {
    device: SERIAL,
    package: PKG,
    sandboxDestructive: true,
    entries,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(ROOT, 'capture_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('MANIFEST_WRITTEN', path.join(ROOT, 'capture_manifest.json'));
}

try {
  main();
} catch (err) {
  console.error('SANDBOX_SCRIPT_ERROR', err.message);
  process.exit(1);
}
