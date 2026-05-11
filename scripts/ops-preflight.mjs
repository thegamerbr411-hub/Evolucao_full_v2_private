import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function warn(msg) {
  console.log(`[WARN] ${msg}`);
  warnings.push(msg);
}

function fail(msg) {
  console.log(`[FAIL] ${msg}`);
  failures.push(msg);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function mustExist(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) {
    fail(`${relativePath} ausente`);
    return null;
  }
  ok(`${relativePath} presente`);
  return full;
}

function hasLine(text, snippet, label) {
  if (text.includes(snippet)) {
    ok(label);
  } else {
    fail(`${label} ausente`);
  }
}

function parseDotEnv(text) {
  const data = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[key] = value;
  }
  return data;
}

function isGoogleClientId(value) {
  return typeof value === 'string' && /\.apps\.googleusercontent\.com$/.test(value.trim());
}

const renderPath = mustExist('render.yaml');
const backendServerPath = mustExist('backend/server.js');
const rootNvmPath = mustExist('.nvmrc');
const backendNvmPath = mustExist('backend/.nvmrc');
const workflowPath = mustExist('.github/workflows/release-apk-on-push.yml');
const gradleWrapperPath = mustExist('android/gradlew');
const googleServicesPath = mustExist('android/app/google-services.json');

if (renderPath) {
  const render = readText(renderPath);
  hasLine(render, 'rootDir: backend', 'Render usa rootDir backend');
  hasLine(render, 'buildCommand: npm ci', 'Render usa npm ci');
  hasLine(render, 'startCommand: npm start', 'Render usa npm start');
  hasLine(render, 'healthCheckPath: /health', 'Render usa health check /health');
  hasLine(render, 'runtimeVersion: 20', 'Render pinado em Node 20');
}

if (backendServerPath) {
  const server = readText(backendServerPath);
  hasLine(server, "app.use('/auth'", 'Backend expõe /auth');
  hasLine(server, "app.use('/api/auth'", 'Backend expõe alias /api/auth');
  hasLine(server, "app.get('/health'", 'Backend expõe /health');
  hasLine(server, "app.get('/api/health'", 'Backend expõe /api/health');
}

if (workflowPath) {
  const workflow = readText(workflowPath);
  hasLine(workflow, 'assembleRelease', 'Pipeline usa Gradle assembleRelease');
  hasLine(workflow, 'actions/setup-java@v4', 'Pipeline configura Java');
  hasLine(workflow, 'actions/upload-artifact@v4', 'Pipeline publica artefato APK');
  if (workflow.includes('expo/expo-github-action@')) {
    fail('Pipeline ainda depende de expo/expo-github-action');
  } else {
    ok('Pipeline sem dependência obrigatória do Expo token');
  }
}

if (rootNvmPath) {
  const v = readText(rootNvmPath).trim();
  if (v !== '20') {
    warn(`.nvmrc raiz esperado 20, encontrado ${v || 'vazio'}`);
  }
}

if (backendNvmPath) {
  const v = readText(backendNvmPath).trim();
  if (v !== '20') {
    warn(`backend/.nvmrc esperado 20, encontrado ${v || 'vazio'}`);
  }
}

const runningInCi = String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';
const EXPECTED_ANDROID_PACKAGE = 'com.tipolt.evolucaofullv2';

if (googleServicesPath) {
  try {
    const parsed = JSON.parse(readText(googleServicesPath));
    const client = Array.isArray(parsed?.client) ? parsed.client[0] : null;
    const androidPackage = String(client?.client_info?.android_client_info?.package_name || '').trim();
    const oauthClients = Array.isArray(client?.oauth_client) ? client.oauth_client : [];
    const androidOauthClients = oauthClients.filter((c) => Number(c?.client_type) === 1 && isGoogleClientId(c?.client_id));
    const hasAndroidClient = androidOauthClients.some((c) => String(c?.android_info?.package_name || '').trim() === EXPECTED_ANDROID_PACKAGE);
    const hasAndroidCertificateHash = androidOauthClients.some((c) => /^[a-f0-9]{40}$/i.test(String(c?.android_info?.certificate_hash || '').trim()));
    const hasWebClient = oauthClients.some((c) => Number(c?.client_type) === 3 && isGoogleClientId(c?.client_id));

    if (androidPackage !== EXPECTED_ANDROID_PACKAGE) {
      fail(`google-services package mismatch: esperado ${EXPECTED_ANDROID_PACKAGE}, encontrado ${androidPackage || 'vazio'}`);
    } else {
      ok(`google-services package Android confere (${EXPECTED_ANDROID_PACKAGE})`);
    }

    if (!hasAndroidClient) {
      if (runningInCi) {
        warn('google-services.json sem OAuth Android valido (CI detectado)');
      } else {
        fail('google-services.json sem OAuth Android valido');
      }
    } else {
      ok('google-services.json com OAuth Android');
    }
    if (!hasAndroidCertificateHash) {
      if (runningInCi) {
        warn('google-services.json sem certificate_hash Android valido (CI detectado)');
      } else {
        fail('google-services.json sem certificate_hash Android valido');
      }
    } else {
      ok('google-services.json com certificate_hash Android valido');
    }
    if (!hasWebClient) warn('google-services.json sem OAuth Web explicito no primeiro client'); else ok('google-services.json com OAuth Web');
  } catch (error) {
    fail(`google-services.json invalido: ${String(error?.message || error)}`);
  }
}

const envPath = path.join(root, '.env');

if (!fs.existsSync(envPath)) {
  if (runningInCi) {
    warn('.env ausente na raiz (CI detectado)');
  } else {
    fail('.env ausente na raiz');
  }
} else {
  const env = parseDotEnv(readText(envPath));
  const required = [
    'EXPO_PUBLIC_API_BASE_URL',
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  ];

  for (const key of required) {
    if (!env[key] || /replace_with/i.test(env[key])) {
      if (runningInCi) {
        warn(`${key} ausente ou placeholder no .env (CI detectado)`);
      } else {
        fail(`${key} ausente ou placeholder`);
      }
    } else {
      ok(`${key} definido`);
    }
  }

  if (!isGoogleClientId(env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '')) {
    if (runningInCi) {
      warn('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID inválido no .env (CI detectado)');
    } else {
      fail('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID inválido');
    }
  }

  if (!isGoogleClientId(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '')) {
    if (runningInCi) {
      warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID inválido no .env (CI detectado)');
    } else {
      fail('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID inválido');
    }
  }

  if (env.EXPO_PUBLIC_APP_VERSION && !/^\d+\.\d+\.\d+$/.test(env.EXPO_PUBLIC_APP_VERSION)) {
    warn(`EXPO_PUBLIC_APP_VERSION fora do padrão semântico: ${env.EXPO_PUBLIC_APP_VERSION}`);
  }
}

console.log('');
if (warnings.length > 0) {
  console.log(`[SUMMARY] ${warnings.length} aviso(s).`);
}

if (failures.length > 0) {
  console.log(`[SUMMARY] ${failures.length} falha(s) bloqueantes.`);
  process.exit(1);
}

console.log('[SUMMARY] Preflight operacional PASS.');
