#!/usr/bin/env node
/** PR #53 — Visual QA V4 (emulator-5554 ONLY, auth bootstrap + resume capture) */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function loadEnvFiles() {
  try {
    const dotenv = require('dotenv');
    for (const name of ['.env', '.env.local', '.env.qa']) {
      dotenv.config({ path: path.join(process.cwd(), name), quiet: true });
    }
  } catch (e) { /* dotenv optional */ }
}
loadEnvFiles();

const ADB = process.env.ADB_PATH || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const SANDBOX_SERIAL = 'emulator-5554';
const REAL_DEVICE = 'RQ8T209ZTAF';
const PKG = 'com.tipolt.evolucaofullv2';
const ROOT = path.join(process.cwd(), '.qa_runtime/visual_audit/hevy_ux_lote_c_v4');
const MANIFEST = path.join(ROOT, 'capture_manifest.json');
const MANUAL_MARKER = path.join(ROOT, 'MANUAL_ASSIST_DONE.marker');
const MANUAL_LOG = path.join(process.cwd(), '.qa_runtime/logs/EVOLUCAO_HEVY_UX_LOTE_C_PR53_MANUAL_ASSIST_INSTRUCTIONS.md');
const AUTH_REQUIRED_LOG = path.join(process.cwd(), '.qa_runtime/logs/EVOLUCAO_HEVY_UX_LOTE_C_PR53_AUTH_REQUIRED_FOR_VISUAL_QA.md');

const args = process.argv.slice(2);
const FRESH_SANDBOX = args.includes('--fresh-sandbox');
const RESUME_CAPTURE = args.includes('--resume-capture-only');
const RESUME_AFTER_LOGIN = args.includes('--resume-after-login');
const MANUAL_PAUSE = args.includes('--manual-assist-wait') || args.includes('--manual-assist-pause');

let lastAuthState = 'AUTH_UNKNOWN_SCREEN';

const BAD_PACKAGES = ['com.nexa.finance', 'com.google.android.permissioncontroller', 'com.android.launcher', 'nexuslauncher'];
const entries = [];

if (process.env.ANDROID_SERIAL && process.env.ANDROID_SERIAL !== SANDBOX_SERIAL) {
  console.error(`ABORT: ANDROID_SERIAL=${process.env.ANDROID_SERIAL}; only ${SANDBOX_SERIAL} allowed`);
  process.exit(10);
}

if (FRESH_SANDBOX) {
  console.error('FRESH_SANDBOX_BLOCKED_TO_PRESERVE_AUTH_SESSION');
  process.exit(12);
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  return `${local.charAt(0)}***@${domain}`;
}

function credentialsPresent() {
  return Boolean(process.env.QA_TEST_EMAIL && process.env.QA_TEST_PASSWORD);
}

function logCredentialPresence() {
  console.log(JSON.stringify({
    QA_TEST_EMAIL: process.env.QA_TEST_EMAIL ? 'PRESENT' : 'MISSING',
    QA_TEST_PASSWORD: process.env.QA_TEST_PASSWORD ? 'PRESENT' : 'MISSING',
    emailMasked: process.env.QA_TEST_EMAIL ? maskEmail(process.env.QA_TEST_EMAIL) : '***',
    passwordMasked: '***',
  }));
}

function assertSandboxSerial() {
  const list = execFileSync(ADB, ['devices'], { encoding: 'utf8' });
  if (list.includes(`${REAL_DEVICE}\tdevice`) && !list.includes(`${SANDBOX_SERIAL}\tdevice`)) {
    console.error(`ABORT: ${REAL_DEVICE} online but sandbox ${SANDBOX_SERIAL} missing`);
    process.exit(15);
  }
  if (!list.includes(`${SANDBOX_SERIAL}\tdevice`)) {
    console.error('ABORT: emulator-5554 not online');
    process.exit(11);
  }
}

function classifyAuthState(xml) {
  if (!xml || xml.length < 300 || !xml.includes('<hierarchy')) return 'AUTH_UI_DUMP_EMPTY';
  if (packageOk(xml) && (/tab-home|tab-treino|screen-workout|btn_home_main_cta|home-ready|app-bootstrap-ready/i.test(xml))) {
    return 'AUTH_ALREADY_LOGGED_IN';
  }
  if (/screen_login|screen-login|input_email|input-email|btn_login|btn-login|btn_go_login|Entre com e-mail/i.test(xml)) {
    return 'AUTH_LOGIN_SCREEN_DETECTED';
  }
  if (/Entrar com Google|you@email\.com|Mín\. 6 caracteres|Treinos, nutrição e progresso/i.test(xml) && /Entrar|Cadastrar|E-mail|Senha/i.test(xml)) {
    return 'AUTH_LOGIN_SCREEN_DETECTED';
  }
  return 'AUTH_UNKNOWN_SCREEN';
}

function adb(...a) {
  return execFileSync(ADB, ['-s', SANDBOX_SERIAL, ...a], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
}

function sleep(ms) { execFileSync('powershell', ['-Command', `Start-Sleep -Milliseconds ${ms}`], { stdio: 'ignore' }); }
function keyevent(c) { adb('shell', 'input', 'keyevent', c); sleep(600); }
function tap(x, y) { adb('shell', 'input', 'tap', String(x), String(y)); sleep(900); }
function scrollDown() { adb('shell', 'input', 'swipe', '540', '1700', '540', '500', '350'); sleep(800); }
function scrollUp() { adb('shell', 'input', 'swipe', '540', '500', '540', '1700', '350'); sleep(800); }
function boundsCenter(t) {
  const m = String(t).match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  return m ? { x: Math.round((+m[1] + +m[3]) / 2), y: Math.round((+m[2] + +m[4]) / 2) } : null;
}

function wakeDevice() {
  keyevent('KEYCODE_WAKEUP');
  adb('shell', 'input', 'keyevent', '82');
  sleep(500);
}

function uiDump() {
  sleep(450);
  const remote = `/sdcard/hulc4_${Date.now()}.xml`;
  const local = path.join(ROOT, `_tmp_dump_${Date.now()}.xml`);
  for (let i = 0; i < 5; i++) {
    try {
      if (i > 0) wakeDevice();
      adb('shell', 'uiautomator', 'dump', remote);
      sleep(400);
      try {
        adb('pull', remote, local);
        if (fs.existsSync(local)) {
          const xml = fs.readFileSync(local, 'utf8');
          try { fs.unlinkSync(local); } catch (e) { /* ok */ }
          if (xml.includes('<hierarchy') && xml.length > 1000) return xml;
        }
      } catch (e) { /* fallback cat */ }
      const xml = adb('shell', 'cat', remote);
      if (xml.includes('<hierarchy') && xml.length > 1000) return xml;
    } catch (e) { /* retry */ }
  }
  return '';
}

function pkg(xml) { return (String(xml).match(/package="([^"]+)"/) || [])[1] || 'unknown'; }
function packageOk(xml) { return pkg(xml) === PKG; }

function assertDestructiveContext(label) {
  assertSandboxSerial();
  const xml = uiDump();
  if (!xml) { console.error(`ABORT ${label}: empty ui dump`); process.exit(13); }
  if (!packageOk(xml)) { console.error(`ABORT ${label}: foreground=${pkg(xml)}`); process.exit(14); }
  return xml;
}

function findPartialResourceBounds(xml, partial) {
  const esc = partial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`resource-id="[^"]*${esc}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'));
  return m ? boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`) : null;
}

function findAllPartialBounds(xml, partial) {
  const esc = partial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`resource-id="([^"]*${esc}[^"]*)"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    const c = boundsCenter(`[${m[2]},${m[3]}][${m[4]},${m[5]}]`);
    if (c) out.push({ id: m[1], ...c });
  }
  return out.sort((a, b) => a.y - b.y);
}

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
  return true;
}

function tapPartialResource(partial, xmlIn) {
  const c = findPartialResourceBounds(xmlIn || uiDump(), partial);
  if (!c) return false;
  tap(c.x, c.y);
  return true;
}

function tapFirstPartial(partial, xmlIn) {
  const items = findAllPartialBounds(xmlIn || uiDump(), partial);
  if (!items.length) return false;
  tap(items[0].x, items[0].y);
  return true;
}

function tapTextContains(substr, xmlIn) {
  const xml = xmlIn || uiDump();
  const esc = substr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`text="[^"]*${esc}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'));
  if (!m) return false;
  const c = boundsCenter(`[${m[1]},${m[2]}][${m[3]},${m[4]}]`);
  tap(c.x, c.y);
  return true;
}

function xmlHas(xml, token) { return String(xml || '').toLowerCase().includes(String(token || '').toLowerCase()); }

function extractTestIds(xml) {
  const ids = [];
  const re = /resource-id="([^"]+)"|content-desc="([^"]+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const v = m[1] || m[2];
    if (v && /workout|summary|finalizar|historico|save-set|input-weight/i.test(v) && !ids.includes(v)) ids.push(v);
    if (ids.length > 40) break;
  }
  return ids;
}

function classifySummary(xml) {
  return {
    screenWorkoutComplete: xmlHas(xml, 'screen-workout-complete'),
    summaryCard: xmlHas(xml, 'workout-summary-card'),
    duration: xmlHas(xml, 'workout-summary-duration'),
    exercises: xmlHas(xml, 'workout-summary-exercises'),
    sets: xmlHas(xml, 'workout-summary-sets'),
    finishedAt: xmlHas(xml, 'workout-summary-finished-at'),
    btnHistory: xmlHas(xml, 'btn-workout-summary-history'),
    btnHome: xmlHas(xml, 'btn-workout-summary-home'),
    copyTitle: /Treino conclu/i.test(xml),
    copySubtitle: /Resumo do treino/i.test(xml),
  };
}

function capture(step, name, meta = {}) {
  fs.mkdirSync(ROOT, { recursive: true });
  const pngPath = path.join(ROOT, `${step}.png`);
  const xmlPath = path.join(ROOT, `${step}.xml`);
  const xml = meta.xml && meta.xml.length > 300 ? meta.xml : uiDump();
  const foregroundPackage = pkg(xml);
  try {
    const buf = execFileSync(ADB, ['-s', SANDBOX_SERIAL, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
    fs.writeFileSync(pngPath, buf);
  } catch (e) {
    adb('shell', 'screencap', '-p', '/sdcard/hulc3_cap.png');
    adb('pull', '/sdcard/hulc3_cap.png', pngPath);
  }
  fs.writeFileSync(xmlPath, xml, 'utf8');
  const summaryChecks = classifySummary(xml);
  const entry = {
    step, name, png: pngPath, xml: xmlPath, foregroundPackage,
    packageOk: packageOk(xml),
    authState: meta.authState || lastAuthState,
    badPackage: BAD_PACKAGES.some((b) => foregroundPackage.includes(b)),
    screenDetected: meta.screenDetected || '',
    textsDetected: (xml.match(/text="([^"]{3,80})"/g) || []).slice(0, 15),
    testIDsDetected: extractTestIds(xml),
    actionBeforeCapture: meta.action || '',
    result: meta.result || '',
    validForPass: meta.validForPass ?? false,
    summaryChecks,
    at: new Date().toISOString(),
  };
  entries.push(entry);
  console.log(JSON.stringify({ step, result: entry.result, packageOk: entry.packageOk, summary: summaryChecks }));
  return { xml, entry };
}

function dismissPermissions() {
  for (let i = 0; i < 5; i++) {
    const xml = uiDump();
    if (packageOk(xml)) return true;
    if (/permissioncontroller|Permitir|Allow|While using/i.test(xml)) {
      tapTextContains('Allow', xml) || tapTextContains('Permitir', xml) || tapTextContains('While using', xml) || tapTextContains('OK', xml);
      sleep(1000);
      continue;
    }
    if (/nexuslauncher/i.test(pkg(xml))) {
      launchApp();
      sleep(2000);
    }
  }
  return packageOk(uiDump());
}

function clearFocusedField() {
  keyevent('KEYCODE_MOVE_END');
  adb('shell', 'input', 'keyevent', 'KEYCODE_CTRL_LEFT');
  adb('shell', 'input', 'keyevent', 'KEYCODE_A');
  sleep(200);
  keyevent('KEYCODE_DEL');
  sleep(200);
}

function sandboxBootstrapAuth() {
  let xml = uiDump();
  lastAuthState = classifyAuthState(xml);
  if (lastAuthState === 'AUTH_ALREADY_LOGGED_IN') return true;
  if (lastAuthState !== 'AUTH_LOGIN_SCREEN_DETECTED') {
    return packageOk(xml);
  }
  logCredentialPresence();
  const email = process.env.QA_TEST_EMAIL || '';
  const password = process.env.QA_TEST_PASSWORD || '';
  if (!email || !password) {
    console.warn('AUTH_BOOTSTRAP_SKIP: credentials missing');
    return false;
  }
  console.log(JSON.stringify({ authBootstrap: 'attempt', emailMasked: maskEmail(email) }));
  tapResource('btn_go_login', xml) || tapPartialResource('btn_go_login', xml) || tapTextContains('Entrar', xml);
  sleep(800);
  xml = uiDump();
  tapResource('input_email', xml) || tapPartialResource('input-email', xml) || tapPartialResource('input_email', xml);
  sleep(400);
  clearFocusedField();
  adb('shell', 'input', 'text', email.replace(/[@.]/g, (c) => (c === '@' ? '\\@' : '\\.')));
  sleep(400);
  xml = uiDump();
  tapResource('input_password', xml) || tapPartialResource('input-password', xml) || tapPartialResource('input_password', xml);
  sleep(400);
  clearFocusedField();
  adb('shell', 'input', 'text', password.replace(/[@. ]/g, (c) => (c === '@' ? '\\@' : c === ' ' ? '%s' : '\\.')));
  sleep(400);
  xml = uiDump();
  tapResource('btn_login', xml) || tapPartialResource('btn-login', xml) || tapTextContains('Entrar', xml);
  sleep(5000);
  for (let i = 0; i < 8; i++) {
    xml = uiDump();
    lastAuthState = classifyAuthState(xml);
    if (lastAuthState === 'AUTH_ALREADY_LOGGED_IN') return true;
    sleep(2000);
  }
  lastAuthState = classifyAuthState(uiDump());
  return lastAuthState === 'AUTH_ALREADY_LOGGED_IN';
}

function writeAuthRequiredDoc() {
  const body = `# EVOLUÇÃO — Auth Required For PR53 Visual QA
## Situação
O emulator-5554 está na tela de login e não há QA_TEST_EMAIL / QA_TEST_PASSWORD no processo.
## O que fazer
Fazer login manual somente no emulator-5554.
## Proibições
- Não usar device real
- Não expor senha em logs
- Não commitar .env
- Não fazer pm clear depois do login
## Depois do login
Rodar:
node .qa_runtime/scripts/hevy_ux_lote_c_sandbox_v4.cjs --resume-after-login
`;
  fs.mkdirSync(path.dirname(AUTH_REQUIRED_LOG), { recursive: true });
  fs.writeFileSync(AUTH_REQUIRED_LOG, body, 'utf8');
  console.log('AUTH_REQUIRED_DOC_WRITTEN', AUTH_REQUIRED_LOG);
}

function captureAuthCheck(action = 'auth_probe') {
  let xml = uiDump();
  if (!xml || xml.length < 300) {
    for (let i = 0; i < 3; i++) {
      wakeDevice();
      launchApp();
      sleep(3000);
      xml = uiDump();
      if (xml && xml.length > 300) break;
    }
  }
  lastAuthState = classifyAuthState(xml);
  return capture('00_auth_check', 'Auth check', {
    xml, action,
    authState: lastAuthState,
    result: lastAuthState,
    validForPass: lastAuthState === 'AUTH_ALREADY_LOGGED_IN',
  });
}

function requireLoggedInOrExit() {
  let xml = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const captured = captureAuthCheck(attempt === 0 ? 'require_logged_in' : `require_logged_in_retry_${attempt}`);
    xml = captured.xml;
    if (lastAuthState === 'AUTH_ALREADY_LOGGED_IN') return xml;
    if (lastAuthState === 'AUTH_LOGIN_SCREEN_DETECTED') break;
    if (lastAuthState === 'AUTH_UI_DUMP_EMPTY') {
      sleep(2000);
      continue;
    }
    sleep(1500);
  }
  if (lastAuthState === 'AUTH_ALREADY_LOGGED_IN') return xml;
  if (lastAuthState === 'AUTH_LOGIN_SCREEN_DETECTED') {
    if (!credentialsPresent()) {
      writeAuthRequiredDoc();
      writeManualAssistInstructions(xml);
      writeManifest(false, 'AUTH_REQUIRED');
      console.error('VERDICT: EVOLUCAO_HEVY_UX_LOTE_C_PR53_AUTH_REQUIRED_FOR_VISUAL_QA');
      process.exit(20);
    }
    const ok = sandboxBootstrapAuth();
    if (!ok) {
      writeAuthRequiredDoc();
      writeManualAssistInstructions(uiDump());
      writeManifest(false, 'AUTH_BOOTSTRAP_FAILED');
      console.error('VERDICT: EVOLUCAO_HEVY_UX_LOTE_C_PR53_AUTH_REQUIRED_FOR_VISUAL_QA');
      process.exit(20);
    }
    return uiDump();
  }
  if (lastAuthState === 'AUTH_UI_DUMP_EMPTY') {
    writeAuthRequiredDoc();
    writeManualAssistInstructions(uiDump() || xml);
    writeManifest(false, 'UIAUTOMATOR_EMPTY');
    console.error('UIAUTOMATOR_EMPTY_DUMP_STILL_BLOCKING');
    process.exit(21);
  }
  if (!credentialsPresent()) {
    writeAuthRequiredDoc();
    writeManualAssistInstructions(xml || uiDump());
    writeManifest(false, 'AUTH_REQUIRED');
    console.error('VERDICT: EVOLUCAO_HEVY_UX_LOTE_C_PR53_AUTH_REQUIRED_FOR_VISUAL_QA');
    process.exit(20);
  }
  return xml;
}

function ensureEvolucaoForeground(maxAttempts = 8) {
  for (let i = 0; i < maxAttempts; i++) {
    dismissPermissions();
    let xml = uiDump();
    if (packageOk(xml)) return xml;
    launchApp();
    sleep(3000);
    dismissPermissions();
    sandboxBootstrapAuth();
    xml = uiDump();
    if (packageOk(xml)) return xml;
  }
  return uiDump();
}

function launchApp() {
  wakeDevice();
  try {
    execFileSync(ADB, ['-s', SANDBOX_SERIAL, 'shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
  } catch (e) { /* ok */ }
  sleep(5000);
}

function dismissOverlays() {
  for (let i = 0; i < 3; i++) {
    const xml = uiDump();
    if (/Feedback rapido|Foi facil usar/i.test(xml)) { keyevent('KEYCODE_BACK'); sleep(500); }
  }
}

function dismissResumeDialog() {
  for (let i = 0; i < 3; i++) {
    const xml = uiDump();
    if (!/Treino em andamento|séries pendentes/i.test(xml)) return;
    tapTextContains('CONTINUAR TREINO', xml) || tapTextContains('Continuar treino', xml);
    sleep(1200);
  }
}

function ensureSimpleMode() {
  for (let i = 0; i < 5; i++) {
    const xml = uiDump();
    if (/workout-mode-simple-active/i.test(xml)) return true;
    tapResource('btn-toggle-workout-mode', xml) || tapPartialResource('btn-toggle-workout-mode', xml);
    sleep(900);
  }
  return /workout-mode-simple-active/i.test(uiDump());
}

function focusActiveExerciseIfNeeded() {
  const xml = uiDump();
  if (/btn-continuar-treino/i.test(xml)) {
    tapResource('btn-continuar-treino', xml) || tapTextContains('Continuar treino', xml);
    sleep(1200);
    return true;
  }
  return false;
}

function prepareWorkoutUI() {
  dismissResumeDialog();
  dismissOverlays();
  ensureSimpleMode();
  focusActiveExerciseIfNeeded();
  for (let i = 0; i < 3; i++) scrollUp();
  sleep(500);
}

function openGuidedWorkout() {
  dismissOverlays();
  let xml = uiDump();
  if (xmlHas(xml, 'screen-workout')) return true;
  tapResource('btn_home_main_cta', xml) || tapTextContains('INICIAR TREINO', xml) || tapTextContains('CONTINUAR TREINO', xml);
  sleep(2500);
  xml = uiDump();
  if (xmlHas(xml, 'screen-workout')) return true;
  tapResource('tab-treino', xml) || tap(270, 2116);
  sleep(2000);
  tapResource('btn-iniciar-treino', uiDump()) || tapTextContains('INICIAR TREINO', uiDump());
  sleep(3000);
  return xmlHas(uiDump(), 'screen-workout');
}

function enterKeypadValue(digits) {
  for (const d of String(digits).split('')) {
    tapResource(`keypad-digit-${d}`) || tapTextContains(d);
    sleep(180);
  }
  tapResource('keypad-confirm') || tapTextContains('OK') || tapTextContains('Confirmar');
  sleep(600);
}

function fillWeightReps() {
  let xml = uiDump();
  if (!/input-weight/i.test(xml)) { for (let s = 0; s < 6; s++) scrollDown(); xml = uiDump(); }
  if (/input-weight/i.test(xml)) {
    tapResource('input-weight', xml) || tapFirstPartial('input-weight', xml);
    sleep(600);
    if (/keypad-digit/i.test(uiDump())) enterKeypadValue('10');
    else adb('shell', 'input', 'text', '10');
    sleep(500);
  }
  xml = uiDump();
  if (/input-reps/i.test(xml)) {
    tapResource('input-reps', xml) || tapFirstPartial('input-reps', xml);
    sleep(600);
    if (/keypad-digit/i.test(uiDump())) enterKeypadValue('10');
    else adb('shell', 'input', 'text', '10');
    sleep(500);
  }
}

function skipRestIfVisible() {
  const xml = uiDump();
  if (/workout-rest-timer-card|btn-rest-timer-skip/i.test(xml)) {
    tapResource('btn-rest-timer-skip', xml) || tapTextContains('Pular', xml);
    sleep(800);
    return true;
  }
  return false;
}

function hasSaveAction(xml) {
  return /btn-save-set/i.test(xml) || /Salvar s/i.test(xml) || /Salvar serie/i.test(xml) || /Salvar série/i.test(xml);
}

function tapSaveAction(xmlIn) {
  const xml = xmlIn || uiDump();
  return tapResource('btn-save-set', xml)
    || tapPartialResource('btn-save-set', xml)
    || tapTextContains('Salvar série', xml)
    || tapTextContains('Salvar serie', xml)
    || tapTextContains('Salvar s', xml);
}

function route2BoundsSave(xml) {
  const patterns = ['Salvar série', 'Salvar serie', 'Salvar s', 'Finalizar treino', 'Concluir'];
  for (const p of patterns) {
    if (tapTextContains(p, xml)) return true;
  }
  return false;
}

function trySaveOneSet() {
  assertDestructiveContext('save_set');
  skipRestIfVisible();
  for (let s = 0; s < 3; s++) scrollUp();
  let xml = uiDump();
  if (!/input-weight/i.test(xml)) { for (let s = 0; s < 8; s++) scrollDown(); xml = uiDump(); }
  if (!/input-weight/i.test(xml)) return { ok: false, reason: 'no_input_weight' };
  fillWeightReps();
  sleep(700);
  xml = uiDump();
  if (!hasSaveAction(xml)) { for (let s = 0; s < 4; s++) scrollDown(); xml = uiDump(); }
  const tapped = tapSaveAction(xml) || route2BoundsSave(xml);
  if (!tapped) return { ok: false, reason: 'save_tap_fail' };
  sleep(1200);
  xml = uiDump();
  const saved = /set-saved-check|set-saved-state/i.test(xml);
  return { ok: saved, reason: saved ? 'saved_confirmed' : 'save_unconfirmed', xml };
}

function completeAllSets(maxRounds = 30) {
  let saved = 0;
  const started = Date.now();
  for (let i = 0; i < maxRounds; i++) {
    if (Date.now() - started > 360000) return { done: false, saved, reason: 'timeout_6min' };
    const xml = uiDump();
    if (/btn-finalizar-treino/i.test(xml)) return { done: true, saved, reason: 'finish_enabled' };
    const r = trySaveOneSet();
    if (r.ok) {
      saved += 1;
      console.log('SAVE_ROUND', saved);
      skipRestIfVisible();
      continue;
    }
    skipRestIfVisible();
    scrollDown();
    route2BoundsSave(uiDump());
  }
  return { done: /btn-finalizar-treino/i.test(uiDump()), saved, reason: 'max_rounds' };
}

function tapFinish() {
  for (let i = 0; i < 8; i++) scrollDown();
  const xml = uiDump();
  if (tapResource('btn-finalizar-treino', xml) || tapTextContains('Finalizar treino', xml)) {
    sleep(3500);
    return true;
  }
  return route2BoundsSave(xml);
}

function writeManualAssistInstructions(xml) {
  const texts = (xml.match(/text="([^"]{2,80})"/g) || []).map((t) => t.replace(/^text="/, '').replace(/"$/, '')).slice(0, 30);
  const body = `# Manual assist — PR #53 Visual QA V4 (emulator-5554 ONLY)

## Device
- Serial: **emulator-5554** only
- Package: com.tipolt.evolucaofullv2
- Real device RQ8T209ZTAF: **do not use**

## Current screen texts
${texts.map((t) => `- ${t}`).join('\n')}

## Actions (on emulator only)
1. Ensure simple mode (toggle if advanced).
2. Tap active exercise if "Toque para focar".
3. Fill weight **10** and reps **10** on pending set.
4. Tap **Salvar série** — repeat until **Finalizar treino** appears.
5. Tap **Finalizar treino** and confirm modal if shown.
6. When screen-workout-complete is visible, re-run:
   \`node .qa_runtime/scripts/hevy_ux_lote_c_sandbox_v4.cjs --resume-capture-only\`

Marker path: \`${MANUAL_MARKER}\`
`;
  fs.mkdirSync(path.dirname(MANUAL_LOG), { recursive: true });
  fs.writeFileSync(MANUAL_LOG, body, 'utf8');
  console.log('MANUAL_ASSIST_INSTRUCTIONS_WRITTEN', MANUAL_LOG);
}

async function waitManualAssist() {
  writeManualAssistInstructions(uiDump());
  if (fs.existsSync(MANUAL_MARKER)) fs.unlinkSync(MANUAL_MARKER);
  console.log('WAITING_MANUAL_ASSIST: complete steps on emulator-5554, then press Enter');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    const poll = setInterval(() => {
      if (fs.existsSync(MANUAL_MARKER)) { clearInterval(poll); rl.close(); resolve(); }
    }, 2000);
    rl.question('Press Enter when summary screen is visible on emulator-5554... ', () => {
      clearInterval(poll);
      rl.close();
      resolve();
    });
  });
}

function captureSummaryPhase() {
  let xml = assertDestructiveContext('summary_capture');
  let checks = classifySummary(xml);
  const summaryOk = checks.screenWorkoutComplete && checks.summaryCard && checks.copyTitle && checks.copySubtitle;

  capture('08_sandbox_workout_summary', 'Workout summary', {
    xml, action: 'capture_summary',
    result: summaryOk ? 'SUMMARY_PASS' : 'SUMMARY_NOT_DETECTED',
    screenDetected: checks.screenWorkoutComplete ? 'screen-workout-complete' : 'unknown',
    validForPass: summaryOk && packageOk(xml),
  });

  scrollDown();
  xml = uiDump();
  checks = classifySummary(xml);
  capture('09_sandbox_summary_stats_detail', 'Summary stats', {
    xml, action: 'scroll_stats',
    result: checks.duration && checks.sets ? 'STATS_VISIBLE' : 'STATS_PARTIAL',
    validForPass: checks.duration && checks.exercises && checks.sets && packageOk(xml),
  });

  capture('10_sandbox_summary_actions', 'Summary CTAs', {
    xml, action: 'capture_ctas',
    result: checks.btnHistory && checks.btnHome ? 'CTAS_VISIBLE' : 'CTAS_PARTIAL',
    validForPass: checks.btnHistory && checks.btnHome && packageOk(xml),
  });

  tapResource('btn-workout-summary-history', xml) || tapTextContains('Ver hist', xml);
  sleep(2500);
  xml = uiDump();
  const historyOk = /Historico|history-local|histórico/i.test(xml);
  capture('11_sandbox_history_after_summary', 'History after summary', {
    xml, action: 'history_nav',
    result: historyOk ? 'HISTORY_REACHED' : 'HISTORY_UNCERTAIN',
    validForPass: historyOk && packageOk(xml),
  });

  keyevent('KEYCODE_BACK');
  keyevent('KEYCODE_BACK');
  xml = uiDump();
  capture('12_sandbox_back_navigation', 'Back navigation', {
    xml, action: 'back',
    result: packageOk(xml) ? 'NAV_OK' : 'NAV_UNCERTAIN',
    validForPass: packageOk(xml),
  });

  return summaryOk;
}

function stabilizeEmulator() {
  console.log('SANDBOX_DESTRUCTIVE_ALLOWED_NOTE: emulator-5554 only (no pm clear by default)');
  wakeDevice();
  adb('shell', 'am', 'force-stop', 'com.nexa.finance');
  adb('shell', 'am', 'force-stop', PKG);
  try { adb('reverse', 'tcp:8081', 'tcp:8081'); } catch (e) { /* ok */ }
  try {
    execFileSync(ADB, ['-s', SANDBOX_SERIAL, 'install', '-r', 'C:\\detox-bin\\app-debug.apk'], { stdio: 'inherit' });
  } catch (e) { console.warn('APK install warn', e.message); }
  launchApp();
}

function writeManifest(visualPass, flowMode) {
  const manifest = {
    device: SANDBOX_SERIAL,
    package: PKG,
    sandboxDestructive: false,
    freshSandboxBlocked: true,
    authState: lastAuthState,
    credentialsPresent: credentialsPresent(),
    flowMode,
    visualPass,
    entries,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log('VISUAL_PASS', visualPass);
  console.log('MANIFEST_WRITTEN', MANIFEST);
}

async function main() {
  assertSandboxSerial();
  fs.mkdirSync(ROOT, { recursive: true });
  logCredentialPresence();

  if (RESUME_CAPTURE) {
    console.log('RESUME_CAPTURE_ONLY');
    requireLoggedInOrExit();
    const pass = captureSummaryPhase();
    writeManifest(pass, 'MANUAL_ASSISTED_SANDBOX_FLOW_USED');
    process.exitCode = pass ? 0 : 2;
    return;
  }

  if (RESUME_AFTER_LOGIN) {
    console.log('RESUME_AFTER_LOGIN');
    stabilizeEmulator();
    let xml = requireLoggedInOrExit();
    if (!packageOk(xml)) {
      writeManifest(false, 'resume_after_login_package_fail');
      process.exit(2);
    }
    return runWorkoutFlow();
  }

  stabilizeEmulator();
  let xml = requireLoggedInOrExit();
  return runWorkoutFlow(xml);
}

async function runWorkoutFlow(initialXml) {
  let xml = initialXml || ensureEvolucaoForeground();
  capture('01_sandbox_package_validation', 'Package validation', {
    xml, action: 'launch+bootstrap',
    result: packageOk(xml) ? 'PACKAGE_OK' : 'PACKAGE_MISMATCH',
    validForPass: packageOk(xml) && !BAD_PACKAGES.some((b) => pkg(xml).includes(b)),
  });
  if (!packageOk(xml)) {
    writeManualAssistInstructions(xml);
    writeManifest(false, 'bootstrap_failed');
    process.exit(2);
  }

  if (!xmlHas(xml, 'screen-workout')) {
    const opened = openGuidedWorkout();
    if (!opened) {
      xml = uiDump();
      lastAuthState = classifyAuthState(xml);
      if (lastAuthState === 'AUTH_LOGIN_SCREEN_DETECTED' || (/Entrar|Cadastrar|E-mail/i.test(xml) && !/tab-home|btn_home_main_cta/i.test(xml))) {
        writeAuthRequiredDoc();
        writeManualAssistInstructions(xml);
        writeManifest(false, 'AUTH_REQUIRED');
        console.error('VERDICT: EVOLUCAO_HEVY_UX_LOTE_C_PR53_AUTH_REQUIRED_FOR_VISUAL_QA');
        process.exit(20);
      }
      writeManualAssistInstructions(xml);
      writeManifest(false, 'WORKOUT_NAV_FAIL');
      process.exit(2);
    }
  }
  prepareWorkoutUI();
  xml = uiDump();
  const opened = xmlHas(xml, 'screen-workout');
  capture('02_sandbox_home_or_treino_entry', 'Home/treino entry', {
    xml, action: 'navigate', result: opened ? 'WORKOUT_NAV_OK' : 'WORKOUT_NAV_FAIL',
    screenDetected: xmlHas(xml, 'screen-workout') ? 'screen-workout' : 'other',
    validForPass: opened && packageOk(xml),
  });

  capture('03_sandbox_workout_selected_or_created', 'Workout open', {
    xml, action: 'workout_open',
    result: xmlHas(xml, 'screen-workout') ? 'WORKOUT_OPEN' : 'WORKOUT_NOT_OPEN',
    validForPass: xmlHas(xml, 'screen-workout') && packageOk(xml),
  });

  capture('04_sandbox_active_workout_before_sets', 'Before sets', {
    xml, action: 'pre_sets',
    result: /input-weight|btn-save-set/i.test(xml) ? 'SETS_READY' : 'SETS_UNCERTAIN',
    validForPass: packageOk(xml),
  });

  const firstSave = trySaveOneSet();
  xml = firstSave.xml || uiDump();
  capture('05_sandbox_first_set_saved', 'First set saved', {
    xml, action: 'first_save',
    result: firstSave.ok ? 'FIRST_SET_SAVED' : firstSave.reason,
    validForPass: firstSave.ok && packageOk(xml),
  });

  let completion = { done: /btn-finalizar-treino/i.test(xml), saved: firstSave.ok ? 1 : 0, reason: 'after_first' };
  if (!completion.done) completion = completeAllSets(30);
  xml = uiDump();
  capture('06_sandbox_all_sets_completed_or_finish_enabled', 'Finish enabled', {
    xml, action: `sets saved=${completion.saved}`,
    result: completion.done ? 'FINISH_ENABLED' : completion.reason,
    validForPass: completion.done && packageOk(xml),
  });

  if (!completion.done) {
    writeManualAssistInstructions(xml);
    writeManifest(false, 'automation_stuck_before_finish');
    process.exitCode = 2;
    return;
  }

  const finished = tapFinish();
  xml = uiDump();
  capture('07_sandbox_finish_action_or_confirmation', 'Finish action', {
    xml, action: 'tap_finish',
    result: finished ? 'FINISH_TAPPED' : 'FINISH_NOT_TAPPED',
    validForPass: packageOk(xml),
  });

  sleep(2500);
  const pass = captureSummaryPhase();
  writeManifest(pass, pass ? 'automated' : 'partial_after_finish');
  process.exitCode = pass ? 0 : 2;
}

main().catch((err) => {
  console.error('SANDBOX_V4_ERROR', err.message);
  process.exit(1);
});
