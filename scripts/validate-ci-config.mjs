/**
 * validate-ci-config.mjs
 * Valida a configuracao do CI localmente (sem precisar de GitHub API).
 * Verifica: YAML do workflow, steps obrigatorios, segredos referenciados,
 *           versoes de Node/Java, existencia de gradlew, e consistencia geral.
 * Uso: node scripts/validate-ci-config.mjs
 * Exit 0 = PASS, Exit 1 = FAIL
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const results = { ok: [], warn: [], fail: [] };

function ok(msg)   { console.log(`[OK]   ${msg}`);   results.ok.push(msg); }
function warn(msg) { console.log(`[WARN] ${msg}`);   results.warn.push(msg); }
function fail(msg) { console.log(`[FAIL] ${msg}`);   results.fail.push(msg); }

function check(condition, okMsg, failMsg, isWarn = false) {
  if (condition) ok(okMsg);
  else if (isWarn) warn(failMsg);
  else fail(failMsg);
}

// ── 1. Workflow principal (release-apk-on-push.yml) ─────────────────────────
const wfPath = path.join(root, '.github', 'workflows', 'release-apk-on-push.yml');
if (!fs.existsSync(wfPath)) {
  fail('.github/workflows/release-apk-on-push.yml ausente');
  process.exit(1);
}

const wf = fs.readFileSync(wfPath, 'utf8');

check(wf.includes('actions/checkout@v4'),         'Usa actions/checkout@v4', 'Nao usa actions/checkout@v4 — pode ser deprecated');
check(wf.includes('actions/setup-node@v4'),       'Usa actions/setup-node@v4', 'Nao usa actions/setup-node@v4');
check(wf.includes("node-version: '20'") || wf.includes("node-version: 20"), 'Node 20 configurado', 'Node version ausente ou incorreta');
check(wf.includes('actions/setup-java@v4'),       'Usa actions/setup-java@v4', 'setup-java nao encontrado');
check(wf.includes("java-version: '17'"),          'Java 17 configurado', 'Java version ausente ou diferente de 17', true);
check(wf.includes('actions/upload-artifact@v4'),  'Usa upload-artifact@v4', 'upload-artifact ausente');
check(wf.includes('softprops/action-gh-release'), 'GitHub Release step presente', 'GitHub Release step ausente', true);
check(wf.includes('assembleRelease'),             'Gradle assembleRelease no workflow', 'assembleRelease nao encontrado no workflow');
check(wf.includes('./gradlew'),                   'Usa gradlew local', 'gradlew local nao referenciado');
check(wf.includes('contents: write'),             'Permissao contents:write configurada', 'Permissao contents:write ausente (necessaria para criar Release)');
check(!wf.includes('expo/expo-github-action@'),   'Sem dependencia expo-github-action', 'AINDA usa expo/expo-github-action (requer EXPO_TOKEN)');
check(wf.includes('npm run ops:preflight'),       'Preflight no CI', 'Preflight ausente no workflow CI — adicionar');

// Verificar branches configurados
if (wf.includes('evolucao-app')) {
  ok('Branch evolucao-app configurado no trigger');
} else {
  warn('Branch evolucao-app nao encontrado no trigger do workflow');
}

// Verificar NODE_OPTIONS para memoria
if (wf.includes('NODE_OPTIONS') && wf.includes('max_old_space_size')) {
  ok('NODE_OPTIONS com max_old_space_size configurado (evita OOM em CI)');
} else {
  warn('NODE_OPTIONS sem max_old_space_size — build grande pode falhar por OOM');
}

// ── 2. Workflow de testes (test.yml) ─────────────────────────────────────────
const testWfPath = path.join(root, '.github', 'workflows', 'test.yml');
if (fs.existsSync(testWfPath)) {
  const testWf = fs.readFileSync(testWfPath, 'utf8');
  check(testWf.includes('npm') || testWf.includes('node'), 'test.yml referencia npm/node', 'test.yml sem referencia a npm/node', true);
  ok('test.yml presente');
} else {
  warn('test.yml ausente — CI de testes nao configurado');
}

// ── 3. Arquivos necessarios para o CI ─────────────────────────────────────────
const required = [
  ['android/gradlew',                    'android/gradlew (executavel Gradle)'],
  ['android/app/google-services.json',   'google-services.json (Firebase Android)'],
  ['android/app/build.gradle',           'android/app/build.gradle'],
  ['package.json',                       'package.json raiz'],
  ['package-lock.json',                  'package-lock.json (necessario para npm ci)'],
  ['scripts/ops-preflight.mjs',          'ops-preflight.mjs'],
  ['scripts/ops-health-smoke.ps1',       'ops-health-smoke.ps1'],
  ['scripts/release-gate.ps1',           'release-gate.ps1'],
  ['scripts/sync-audit-release.js',      'sync-audit-release.js (audit:release:check)'],
];

for (const [rel, label] of required) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) ok(`${label} presente`);
  else fail(`${label} AUSENTE — CI vai falhar`);
}

// ── 4. Verificar scripts npm referenciados no workflow ─────────────────────────
const pkgPath = path.join(root, 'package.json');
let pkg;
try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch { fail('package.json invalido'); }

if (pkg) {
  const scripts = pkg.scripts || {};
  const ciScripts = [
    'audit:release:sync',
    'audit:release:check',
    'ops:preflight',
  ];
  for (const s of ciScripts) {
    if (scripts[s]) ok(`npm run ${s} definido`);
    else fail(`npm run ${s} AUSENTE no package.json — CI vai falhar neste step`);
  }
}

// ── 5. Verificar render.yaml vs deploy esperado ───────────────────────────────
const renderPath = path.join(root, 'render.yaml');
if (fs.existsSync(renderPath)) {
  const render = fs.readFileSync(renderPath, 'utf8');
  check(render.includes('rootDir: backend'),      'render.yaml rootDir=backend', 'render.yaml sem rootDir backend — deploy vai usar raiz errada');
  check(render.includes('buildCommand: npm ci'),  'render.yaml buildCommand=npm ci', 'render.yaml sem npm ci');
  check(render.includes('startCommand: npm start'),'render.yaml startCommand=npm start','render.yaml sem npm start');
  check(render.includes('healthCheckPath: /health'),'render.yaml healthCheck=/health','render.yaml sem healthCheckPath');
  check(render.includes('runtimeVersion: 20'),    'render.yaml Node 20', 'render.yaml sem runtimeVersion:20 — pode usar Node errado');
} else {
  fail('render.yaml ausente');
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────────');
console.log(`[SUMMARY] OK=${results.ok.length}  WARN=${results.warn.length}  FAIL=${results.fail.length}`);

if (results.fail.length > 0) {
  console.log('[SUMMARY] FAIL — CI com problemas estruturais. Ver [FAIL] acima.');
  console.log('[SUMMARY] Corrigir ANTES de push para evitar run vermelho.\n');
  process.exit(1);
} else if (results.warn.length > 0) {
  console.log('[SUMMARY] PASS com avisos — CI deve funcionar mas revisar [WARN].\n');
  process.exit(0);
} else {
  console.log('[SUMMARY] PASS — Configuracao do CI validada.\n');
  process.exit(0);
}
