#!/usr/bin/env node
/** Hevy UX Lote D — History continuity sandbox (emulator-5554, no workout finish) */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADB = process.env.ADB_PATH || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const SERIAL = 'emulator-5554';
const REAL_DEVICE = 'RQ8T209ZTAF';
const PKG = 'com.tipolt.evolucaofullv2';
const ROOT = path.join(process.cwd(), '.qa_runtime/visual_audit/hevy_ux_lote_d_history_continuity');
const BAD_PKGS = [/com\.nexa\.finance/i, /nexuslauncher/i, /permissioncontroller/i];
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
  const remote = `/sdcard/lote_d_${Date.now()}.xml`;
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
function packageOk(xml) {
  const p = pkg(xml);
  return p === PKG && !BAD_PKGS.some((re) => re.test(xml));
}
function xmlHas(xml, id) {
  return new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(xml);
}
function findResourceBounds(xml, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`resource-id="[^"]*${esc}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'));
  return m ? boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`) : null;
}
function tapResource(id) {
  const c = findResourceBounds(uiDump(), id);
  if (!c) return false;
  tap(c.x, c.y);
  sleep(2500);
  return true;
}
function tapTextContains(substr) {
  const xml = uiDump();
  const esc = substr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`text="[^"]*${esc}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'));
  if (!m) return false;
  const c = boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`);
  tap(c.x, c.y);
  sleep(2500);
  return true;
}
function launchEvo() {
  execFileSync(ADB, ['-s', SERIAL, 'shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
  sleep(5000);
}
function tapTab(name) {
  const coords = { home: [90, 2116], treino: [270, 2116] };
  const id = name === 'home' ? 'tab-home' : 'tab-treino';
  const c = findResourceBounds(uiDump(), id);
  const fb = coords[name];
  tap(c ? c.x : fb[0], c ? c.y : fb[1]);
  sleep(2800);
}
function capture(id, name, meta = {}) {
  const xml = meta.xml || uiDump();
  const ok = packageOk(xml);
  fs.mkdirSync(ROOT, { recursive: true });
  const pngPath = path.join(ROOT, `${id}.png`);
  const xmlPath = path.join(ROOT, `${id}.xml`);
  try {
    const buf = execFileSync(ADB, ['-s', SERIAL, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
    fs.writeFileSync(pngPath, buf);
  } catch (e) {
    adb('shell', 'screencap', '-p', '/sdcard/lote_d_cap.png');
    adb('pull', '/sdcard/lote_d_cap.png', pngPath);
  }
  fs.writeFileSync(xmlPath, xml, 'utf8');
  const entry = {
    id, name, device: SERIAL, package: pkg(xml), packageOk: ok,
    result: meta.result || (ok ? 'SANDBOX_OK' : 'SANDBOX_PACKAGE_MISMATCH'),
    action: meta.action || '', at: new Date().toISOString(),
  };
  entries.push(entry);
  console.log(JSON.stringify({ id, result: entry.result, packageOk: ok }));
  return { xml, entry, ok };
}

function main() {
  const devs = execFileSync(ADB, ['devices'], { encoding: 'utf8' });
  if (devs.includes(`${REAL_DEVICE}\tdevice`) && !devs.includes(`${SERIAL}\tdevice`)) {
    console.error('ABORT: real device only, sandbox missing');
    process.exit(15);
  }
  if (!devs.includes(`${SERIAL}\tdevice`)) {
    console.error('ABORT: emulator-5554 offline');
    process.exit(11);
  }

  launchEvo();
  capture('01_sandbox_home', 'Home', { action: 'launch' });

  tapTab('treino');
  capture('02_sandbox_treino_hub', 'Treino hub', { action: 'tab-treino' });

  const histTap = tapResource('btn_open_history') || tapTextContains('Histórico') || tapTextContains('historico');
  const histXml = uiDump();
  const historyReached = packageOk(histXml) && (xmlHas(histXml, 'screen-history') || /Treinos salvos|history-backend|Histórico dos Últimos/i.test(histXml));
  capture('03_sandbox_history_entry', 'History entry', {
    xml: histXml,
    action: histTap ? 'history_nav' : 'history_nav_failed',
    result: historyReached ? 'HISTORY_REACHED' : 'VISUAL_SANDBOX_AUTH_OR_DATA_LIMITATION',
  });

  if (historyReached) {
    scrollDown();
    scrollDown();
    const cardsXml = uiDump();
    const cardsOk = xmlHas(cardsXml, 'history-session-card') || xmlHas(cardsXml, 'history-empty-state') || /Treinos salvos/i.test(cardsXml);
    capture('04_sandbox_history_cards', 'History cards', {
      xml: cardsXml,
      result: cardsOk ? 'HISTORY_CARDS_VISIBLE' : 'HISTORY_CARDS_UNCERTAIN',
    });

    if (tapResource('history-session-card') || tapTextContains('Treino')) {
      const detailXml = uiDump();
      capture('05_sandbox_history_detail_or_expanded', 'History detail', {
        xml: detailXml,
        result: xmlHas(detailXml, 'history-session-detail') ? 'HISTORY_DETAIL_VISIBLE' : 'HISTORY_DETAIL_UNCERTAIN',
      });
      tapResource('btn-history-session-back') || keyevent('KEYCODE_BACK');
    } else {
      capture('05_sandbox_history_empty_or_fallback_if_available', 'History empty/fallback', {
        xml: cardsXml,
        result: xmlHas(cardsXml, 'history-empty-state') ? 'HISTORY_EMPTY_STATE_VISIBLE' : 'HISTORY_DETAIL_SKIPPED',
      });
    }

    keyevent('KEYCODE_BACK');
    capture('06_sandbox_back_navigation', 'Back navigation', { action: 'back from history' });
  }

  const visualPass = entries.some((e) => e.result === 'HISTORY_REACHED') && entries.every((e) => e.packageOk || e.result.includes('LIMITATION'));
  fs.writeFileSync(path.join(ROOT, 'capture_manifest.json'), JSON.stringify({
    verdictTarget: visualPass ? 'EVOLUCAO_HEVY_UX_LOTE_D_HISTORY_CONTINUITY_DRAFT_PR_READY' : 'EVOLUCAO_HEVY_UX_LOTE_D_HISTORY_CONTINUITY_DRAFT_PR_VISUAL_PENDING',
    visualPass,
    device: SERIAL,
    package: PKG,
    readOnly: true,
    noWorkoutFinish: true,
    captures: entries,
    at: new Date().toISOString(),
  }, null, 2));
  console.log('DONE', ROOT, 'visualPass=', visualPass);
}

try { main(); } catch (e) {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'SANDBOX_ERROR.txt'), String(e.message || e));
  console.error(e.message || e);
  process.exit(1);
}
