#!/usr/bin/env node
/** PR #54 — Hevy UX Lote D History Visual QA v1 (emulator-5554 ONLY) */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadEnvFiles() {
  try {
    const dotenv = require('dotenv');
    for (const name of ['.env', '.env.local', '.env.qa']) {
      dotenv.config({ path: path.join(process.cwd(), name), quiet: true });
    }
  } catch (e) { /* optional */ }
}
loadEnvFiles();

const ADB = process.env.ADB_PATH || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const SERIAL = 'emulator-5554';
const PKG = 'com.tipolt.evolucaofullv2';
const BRANCH = 'feat/hevy-ux-lote-d-history-continuity';
const COMMIT = '6110b349cfb29e90570149ba7e124f7d854d80a9';
const ROOT = path.join(process.cwd(), '.qa_runtime/visual_audit/hevy_ux_lote_d_history_continuity_v1');
const BAD_PKGS = [/com\.nexa\.finance/i, /nexuslauncher/i, /permissioncontroller/i, /com\.android\.launcher/i];
const TEST_IDS = [
  'screen-history', 'history-backend-sessions-panel', 'history-empty-state',
  'history-session-card', 'history-session-title', 'history-session-date',
  'history-session-duration', 'history-session-exercises', 'history-session-sets',
  'history-session-detail', 'history-session-detail-card', 'history-session-detail-exercise-list',
  'btn-history-session-back',
];
const EMPTY_COPY = 'Seu histórico aparece aqui. Finalize um treino para ver suas séries, cargas e evolução.';

if (process.env.ANDROID_SERIAL && process.env.ANDROID_SERIAL !== SERIAL) {
  console.error(`ABORT: ANDROID_SERIAL=${process.env.ANDROID_SERIAL}; only ${SERIAL}`);
  process.exit(10);
}

const entries = [];
const screenshots = [];
const xmls = [];

function adb(...args) {
  return execFileSync(ADB, ['-s', SERIAL, ...args], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
}
function sleep(ms) { execFileSync('powershell', ['-Command', `Start-Sleep -Milliseconds ${ms}`], { stdio: 'ignore' }); }
function keyevent(c) { adb('shell', 'input', 'keyevent', c); sleep(600); }
function tap(x, y) { adb('shell', 'input', 'tap', String(x), String(y)); sleep(900); }
function scrollDown(n = 1) {
  for (let i = 0; i < n; i++) {
    adb('shell', 'input', 'swipe', '540', '1600', '540', '600', '400');
    sleep(900);
  }
}
function scrollUp(n = 1) {
  for (let i = 0; i < n; i++) {
    adb('shell', 'input', 'swipe', '540', '600', '540', '1600', '400');
    sleep(900);
  }
}
function boundsCenter(t) {
  const m = String(t).match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  return m ? { x: Math.round((+m[1] + +m[3]) / 2), y: Math.round((+m[2] + +m[4]) / 2) } : null;
}
function wakeDevice() {
  keyevent('KEYCODE_WAKEUP');
  adb('shell', 'input', 'keyevent', '82');
  sleep(500);
}
function rawUiDump() {
  sleep(450);
  const remote = `/sdcard/lote_d_v1_${Date.now()}.xml`;
  const local = path.join(ROOT, `_tmp_${Date.now()}.xml`);
  for (let i = 0; i < 5; i++) {
    try {
      if (i > 0) wakeDevice();
      adb('shell', 'uiautomator', 'dump', remote);
      sleep(350);
      try {
        adb('pull', remote, local);
        if (fs.existsSync(local)) {
          const xml = fs.readFileSync(local, 'utf8');
          try { fs.unlinkSync(local); } catch (e) { /* ok */ }
          if (xml.includes('<hierarchy') && xml.length > 800) return xml;
        }
      } catch (e) { /* cat fallback */ }
      const xml = adb('shell', 'cat', remote);
      if (xml.includes('<hierarchy') && xml.length > 800) return xml;
    } catch (e) { /* retry */ }
  }
  return '';
}
function uiDump() { return rawUiDump(); }
function pkg(xml) {
  const m = String(xml).match(/package="([^"]+)"/);
  return m ? m[1] : 'unknown';
}
function packageOk(xml) {
  const p = pkg(xml);
  return p === PKG && !BAD_PKGS.some((re) => re.test(xml));
}
function xmlHas(xml, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc, 'i').test(xml);
}
function detectTestIds(xml) {
  return TEST_IDS.filter((id) => xmlHas(xml, id));
}
function classifyAuthState(xml) {
  if (!xml || xml.length < 300) return 'AUTH_UI_DUMP_EMPTY';
  if (packageOk(xml) && (/tab-home|tab-treino|screen-history|btn_open_history|home_ready|screen_home|app_bootstrap_ready/i.test(xml))) {
    return 'AUTH_ALREADY_LOGGED_IN';
  }
  if (/screen_login|screen-login|input_email|btn_login|Entre com e-mail|Entrar com Google/i.test(xml)) {
    return 'AUTH_LOGIN_SCREEN_DETECTED';
  }
  return 'AUTH_UNKNOWN_SCREEN';
}
function findResourceBounds(xml, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`resource-id="[^"]*${esc}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'));
  if (m) return boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`);
  const idx = xml.search(new RegExp(`resource-id="[^"]*${esc}"`, 'i'));
  if (idx < 0) return null;
  const chunk = xml.slice(idx, idx + 500);
  const bm = chunk.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  return bm ? boundsCenter(`[${bm[1]},${bm[2]}][${bm[3]},${bm[4]}]`) : null;
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
  tap(boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`).x, boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`).y);
  sleep(2500);
  return true;
}
function dismissSystemDialogs() {
  for (let i = 0; i < 3; i++) {
    const xml = uiDump();
    if (!/System UI isn|aerr_wait|aerr_close/i.test(xml)) return;
    if (tapResource('aerr_wait', xml) || tapResource('aerr_close', xml)) continue;
    keyevent('KEYCODE_BACK');
  }
}
function launchEvo() {
  wakeDevice();
  execFileSync(ADB, ['-s', SERIAL, 'shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
  sleep(5000);
}
function waitForBootstrap(maxSec = 90) {
  for (let i = 0; i < maxSec; i++) {
    const xml = uiDump();
    if (!packageOk(xml)) { sleep(1000); continue; }
    if (/screen_loading/i.test(xml) && !/home_ready|tab-home|tab-treino/i.test(xml)) { sleep(1000); continue; }
    if (/tab-home|tab-treino|home_ready|screen_home|btn_home_main_cta/i.test(xml)) return xml;
    sleep(1000);
  }
  return uiDump();
}
function scrollUntilFound(checkFn, max = 10) {
  scrollUp(2);
  for (let i = 0; i < max; i++) {
    const xml = uiDump();
    if (checkFn(xml)) return xml;
    scrollDown(1);
  }
  return uiDump();
}
function ensureTreinoHub() {
  for (let round = 0; round < 14; round++) {
    let xml = uiDump();
    if (!packageOk(xml)) { launchEvo(); sleep(3000); continue; }
    const tab = findResourceBounds(xml, 'tab-treino');
    if (tab) tap(tab.x, tab.y); else tap(270, 2116);
    sleep(2800);
    xml = uiDump();
    if (/btn_open_history|Ver histórico de treinos|Ver historico de treinos/i.test(xml)) return xml;
    if (/screen-history|history-local-logs|Historico dos/i.test(xml)) return xml;
    scrollDown(1);
  }
  return scrollUntilFound((x) => findResourceBounds(x, 'btn_open_history') || /Ver histórico de treinos|Ver historico de treinos/i.test(x), 10);
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
    adb('shell', 'screencap', '-p', '/sdcard/lote_d_v1_cap.png');
    adb('pull', '/sdcard/lote_d_v1_cap.png', pngPath);
  }
  fs.writeFileSync(xmlPath, xml, 'utf8');
  if (!screenshots.includes(`${id}.png`)) screenshots.push(`${id}.png`);
  if (!xmls.includes(`${id}.xml`)) xmls.push(`${id}.xml`);
  const entry = {
    id, name, device: SERIAL, package: pkg(xml), packageOk: ok,
    testIds: detectTestIds(xml),
    authState: classifyAuthState(xml),
    result: meta.result || (ok ? 'SANDBOX_OK' : 'SANDBOX_PACKAGE_MISMATCH'),
    action: meta.action || '',
    at: new Date().toISOString(),
  };
  entries.push(entry);
  console.log(JSON.stringify({ id, result: entry.result, packageOk: ok, testIds: entry.testIds.length }));
  return { xml, entry, ok };
}
function assertSandbox() {
  const devs = execFileSync(ADB, ['devices'], { encoding: 'utf8' });
  if (!devs.includes(`${SERIAL}\tdevice`)) {
    console.error('ABORT: emulator-5554 offline');
    process.exit(11);
  }
}
function historyReached(xml) {
  return packageOk(xml) && (
    xmlHas(xml, 'screen-history')
    || /Treinos salvos|history-backend-sessions-panel|history-local-logs-panel|Histórico dos Últimos|Historico dos Ultimos/i.test(xml)
  );
}
function evaluateVisual(allXml, authState) {
  const combined = allXml.join('\n');
  const historyScreenDetected = xmlHas(combined, 'screen-history') || /Histórico dos Últimos|Historico dos Ultimos/i.test(combined);
  const backendBlockDetected = xmlHas(combined, 'history-backend-sessions-panel') || /Treinos salvos/i.test(combined);
  const emptyStateDetected = xmlHas(combined, 'history-empty-state') || combined.includes(EMPTY_COPY) || /Seu histórico aparece aqui/i.test(combined);
  const sessionCardDetected = xmlHas(combined, 'history-session-card');
  const detailInlineDetected = xmlHas(combined, 'history-session-detail');
  const testIdsDetected = TEST_IDS.filter((id) => xmlHas(combined, id));
  const copyDetected = /Duração|Exercícios|Séries|Treinos salvos|Finalizado em|histórico aparece/i.test(combined);

  let visualPass = false;
  let visualLimitation = false;
  let limitationReason = '';
  let visualResult = 'VISUAL_SANDBOX_EMULATOR_BLOCKED';

  if (sessionCardDetected && detailInlineDetected && xmlHas(combined, 'btn-history-session-back')) {
    visualPass = true;
    visualResult = 'VISUAL_SANDBOX_PASS_WITH_BACKEND_CARD';
  } else if (emptyStateDetected && historyScreenDetected && backendBlockDetected) {
    visualPass = true;
    visualResult = 'VISUAL_SANDBOX_PASS_WITH_EMPTY_STATE';
  } else if (historyScreenDetected && backendBlockDetected && sessionCardDetected) {
    visualPass = true;
    visualResult = 'VISUAL_SANDBOX_PASS_WITH_BACKEND_CARD_PARTIAL';
  } else if (authState === 'AUTH_LOGIN_SCREEN_DETECTED' || authState === 'AUTH_UI_DUMP_EMPTY') {
    visualLimitation = true;
    limitationReason = 'VISUAL_SANDBOX_AUTH_OR_DATA_LIMITATION';
    visualResult = limitationReason;
  } else if (historyScreenDetected && !historyReached(combined)) {
    visualLimitation = true;
    limitationReason = 'VISUAL_SANDBOX_AUTH_OR_DATA_LIMITATION';
    visualResult = limitationReason;
  } else if (!historyScreenDetected && authState === 'AUTH_ALREADY_LOGGED_IN') {
    visualLimitation = true;
    limitationReason = 'VISUAL_SANDBOX_AUTH_OR_DATA_LIMITATION';
    visualResult = limitationReason;
  }

  return {
    historyScreenDetected, backendBlockDetected, emptyStateDetected,
    sessionCardDetected, detailInlineDetected, testIdsDetected, copyDetected,
    visualPass, visualLimitation, limitationReason, visualResult,
  };
}
function stabilize() {
  wakeDevice();
  dismissSystemDialogs();
  adb('shell', 'am', 'force-stop', PKG);
  sleep(800);
  launchEvo();
}
function main() {
  assertSandbox();
  stabilize();
  const preXml = uiDump();
  capture('00_sandbox_preflight', 'Preflight', {
    xml: preXml,
    action: 'preflight',
    result: packageOk(preXml) ? 'PREFLIGHT_OK' : 'PREFLIGHT_PACKAGE_MISMATCH',
  });

  const bootXml = waitForBootstrap();
  const home = capture('01_sandbox_home', 'Home', { xml: bootXml, action: 'launch+bootstrap' });

  const hubXml = ensureTreinoHub();
  capture('02_sandbox_treino_hub', 'Treino hub', { xml: hubXml, action: 'tab-treino+scroll' });

  const hubForTap = scrollUntilFound((x) => findResourceBounds(x, 'btn_open_history') || /Ver histórico de treinos|Ver historico de treinos/i.test(x), 8);
  const histTap = tapResource('btn_open_history', hubForTap)
    || tapTextContains('Ver histórico de treinos', hubForTap)
    || tapTextContains('Ver historico de treinos', hubForTap)
    || tapTextContains('Histórico', hubForTap);
  sleep(2000);
  const histXml = uiDump();
  const reached = historyReached(histXml);
  capture('02_sandbox_history_entry', 'History entry', {
    xml: histXml,
    action: histTap ? 'history_nav' : 'history_nav_failed',
    result: reached ? 'HISTORY_REACHED' : 'VISUAL_SANDBOX_AUTH_OR_DATA_LIMITATION',
  });

  const collectedXml = [home.xml, hubXml, histXml];
  const authState = classifyAuthState(histXml || bootXml);

  if (reached) {
    scrollDown(2);
    const backendXml = uiDump();
    collectedXml.push(backendXml);
    capture('03_sandbox_history_backend_block_or_empty', 'Backend block or empty', { xml: backendXml, action: 'scroll backend' });

    if (xmlHas(backendXml, 'history-session-card')) {
      tapResource('history-session-card', backendXml) || tapTextContains('Treino', backendXml);
      sleep(1500);
      const cardXml = uiDump();
      collectedXml.push(cardXml);
      capture('04_sandbox_history_session_card', 'Session card', { xml: cardXml });

      const detailXml = uiDump();
      collectedXml.push(detailXml);
      capture('05_sandbox_history_detail_inline', 'Detail inline', { xml: detailXml });

      tapResource('btn-history-session-back', detailXml) || keyevent('KEYCODE_BACK');
      sleep(1500);
      capture('06_sandbox_history_back_navigation', 'Back navigation', { action: 'back from detail' });
    } else {
      capture('04_sandbox_history_session_card', 'Session card skipped', { xml: backendXml, result: 'NO_SESSION_CARD_EMPTY_OR_LOADING' });
      capture('05_sandbox_history_detail_inline', 'Detail skipped', { xml: backendXml, result: 'DETAIL_SKIPPED_NO_CARD' });
    }

    keyevent('KEYCODE_BACK');
    sleep(1500);
    const finalXml = uiDump();
    collectedXml.push(finalXml);
    capture('07_sandbox_final_state', 'Final state', { xml: finalXml, action: 'back to hub' });
  }

  const evalResult = evaluateVisual(collectedXml, authState);
  const manifest = {
    sourceOfTruth: 'EVOLUCAO_HEVY_UX_LOTE_D_HISTORY_CONTINUITY_DRAFT_PR_VISUAL_PENDING',
    verdictTarget: evalResult.visualPass
      ? 'EVOLUCAO_HEVY_UX_LOTE_D_PR54_READY_GATE_COMPLETE'
      : (evalResult.visualLimitation ? 'EVOLUCAO_HEVY_UX_LOTE_D_PR54_STILL_DRAFT_VISUAL_DATA_PENDING' : 'EVOLUCAO_HEVY_UX_LOTE_D_PR54_STILL_DRAFT_EMULATOR_BLOCKED'),
    branch: BRANCH,
    commit: COMMIT,
    serial: SERIAL,
    package: PKG,
    packageOk: entries.filter((e) => !/SKIPPED|PREFLIGHT_PACKAGE_MISMATCH/i.test(e.result)).every((e) => e.packageOk),
    authState,
    ...evalResult,
    readOnly: true,
    noWorkoutFinish: true,
    screenshots,
    xmls,
    captures: entries,
    at: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(ROOT, 'capture_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('DONE', ROOT, 'visualPass=', evalResult.visualPass, 'result=', evalResult.visualResult);
  process.exit(evalResult.visualPass ? 0 : 2);
}

try { main(); } catch (e) {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'SANDBOX_ERROR.txt'), String(e.message || e));
  console.error(e.message || e);
  process.exit(1);
}
