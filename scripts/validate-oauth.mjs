/**
 * validate-oauth.mjs
 * Validacao dedicada de configuracao OAuth Google.
 * Verifica: .env, google-services.json e consistencia entre ambos.
 * Uso: node scripts/validate-oauth.mjs
 * Exit 0 = PASS, Exit 1 = FAIL
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const results = { ok: [], warn: [], fail: [] };

function ok(msg)   { console.log(`[OK]   ${msg}`);   results.ok.push(msg); }
function warn(msg) { console.log(`[WARN] ${msg}`);   results.warn.push(msg); }
function fail(msg) { console.log(`[FAIL] ${msg}`);   results.fail.push(msg); }

function isGoogleId(v) {
  return typeof v === 'string' && /\.apps\.googleusercontent\.com$/.test(v.trim()) && v.trim().length > 30;
}

function parseDotEnv(text) {
  const d = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    d[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return d;
}

// ── 1. Verificar .env ────────────────────────────────────────────────────────
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  fail('.env nao encontrado na raiz');
  console.log('\n[SUMMARY] FAIL — .env ausente, impossivel validar OAuth.\n');
  process.exit(1);
}

const env = parseDotEnv(fs.readFileSync(envPath, 'utf8'));

const androidClientId = env['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'];
const webClientId     = env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'];
const expoClientId    = env['EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID'];

if (isGoogleId(androidClientId)) {
  ok(`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = ...${androidClientId.slice(-30)}`);
} else {
  fail('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ausente ou invalido no .env');
}

if (isGoogleId(webClientId)) {
  ok(`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = ...${webClientId.slice(-30)}`);
} else {
  warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ausente ou invalido (pode usar fallback)');
}

if (isGoogleId(expoClientId)) {
  ok(`EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID = ...${expoClientId.slice(-30)}`);
} else {
  warn('EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ausente ou invalido');
}

// ── 2. Verificar google-services.json ────────────────────────────────────────
const gsPath = path.join(root, 'android', 'app', 'google-services.json');
if (!fs.existsSync(gsPath)) {
  fail('android/app/google-services.json nao encontrado');
  console.log('\n[SUMMARY] FAIL — google-services.json ausente.\n');
  process.exit(1);
}

let gs;
try {
  gs = JSON.parse(fs.readFileSync(gsPath, 'utf8'));
} catch (e) {
  fail(`google-services.json JSON invalido: ${e.message}`);
  process.exit(1);
}

const projectNumber = gs?.project_info?.project_number;
const projectId     = gs?.project_info?.project_id;
const client        = Array.isArray(gs?.client) ? gs.client[0] : null;

if (projectId) ok(`google-services.json project_id = ${projectId}`); else fail('google-services.json sem project_id');
if (projectNumber) ok(`google-services.json project_number = ${projectNumber}`); else warn('google-services.json sem project_number');

// ── 3. Verificar package name ─────────────────────────────────────────────────
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
let appId = '';
if (fs.existsSync(gradlePath)) {
  const gradle = fs.readFileSync(gradlePath, 'utf8');
  const match = gradle.match(/applicationId\s+["']([^"']+)["']/);
  if (match) {
    appId = match[1];
    ok(`applicationId no build.gradle = ${appId}`);
  } else {
    warn('applicationId nao encontrado no build.gradle');
  }
}

const gsPackageName = client?.client_info?.android_client_info?.package_name;
if (gsPackageName) {
  ok(`google-services.json package_name = ${gsPackageName}`);
  if (appId && gsPackageName !== appId) {
    fail(`MISMATCH: package_name (${gsPackageName}) != applicationId (${appId})`);
  } else if (appId) {
    ok('package_name BATE com applicationId');
  }
} else {
  fail('google-services.json sem package_name no client[0]');
}

// ── 4. Verificar OAuth clients no google-services ─────────────────────────────
const oauthClients = Array.isArray(client?.oauth_client) ? client.oauth_client : [];
const androidOauth = oauthClients.find(c => Number(c?.client_type) === 1);
const webOauth     = oauthClients.find(c => Number(c?.client_type) === 3);

if (androidOauth && isGoogleId(androidOauth.client_id)) {
  ok(`OAuth Android no google-services: ...${androidOauth.client_id.slice(-30)}`);
  // Checar se bate com o .env
  if (androidClientId && androidOauth.client_id !== androidClientId) {
    warn(`OAuth Android no google-services DIVERGE do .env:\n       gs: ${androidOauth.client_id}\n      env: ${androidClientId}`);
  } else if (androidClientId) {
    ok('OAuth Android google-services BATE com .env');
  }
} else {
  fail('OAuth client Android (client_type=1) ausente ou invalido no google-services.json');
}

if (webOauth && isGoogleId(webOauth.client_id)) {
  ok(`OAuth Web no google-services: ...${webOauth.client_id.slice(-30)}`);
} else {
  warn('OAuth client Web (client_type=3) ausente no google-services.json — pode causar problema no fluxo web');
}

// ── 5. Verificar authService usa selecao por plataforma ─────────────────────
const authSvcPath = path.join(root, 'src', 'services', 'authService.js');
if (fs.existsSync(authSvcPath)) {
  const authSvc = fs.readFileSync(authSvcPath, 'utf8');
  if (authSvc.includes('androidClientId') || authSvc.includes('ANDROID_CLIENT_ID')) {
    ok('authService.js usa androidClientId (separacao por plataforma)');
  } else {
    warn('authService.js pode nao diferenciar androidClientId — revisar selecao por plataforma');
  }
  if (authSvc.includes('Platform.OS') || authSvc.includes('platform') || authSvc.includes('Platform')) {
    ok('authService.js referencia Platform (selecao de client por OS)');
  } else {
    warn('authService.js sem referencia a Platform — verificar se client correto e usado no Android');
  }
} else {
  warn('src/services/authService.js nao encontrado para validacao');
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────────────');
console.log(`[SUMMARY] OK=${results.ok.length}  WARN=${results.warn.length}  FAIL=${results.fail.length}`);

if (results.fail.length > 0) {
  console.log('[SUMMARY] FAIL — OAuth com problemas criticos. Ver [FAIL] acima.\n');
  process.exit(1);
} else if (results.warn.length > 0) {
  console.log('[SUMMARY] PASS com avisos — verifique [WARN] antes de release em device real.\n');
  process.exit(0);
} else {
  console.log('[SUMMARY] PASS — OAuth configurado corretamente.\n');
  process.exit(0);
}
