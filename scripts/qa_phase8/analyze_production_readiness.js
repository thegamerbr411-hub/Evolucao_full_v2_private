/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'qa_phase8_production_readiness');
const OUT_RUNS = path.join(OUT_ROOT, 'QA_RUNS');

const RUN_SOURCES = [
  path.join(ROOT, 'qa_phase8_production_readiness', 'QA_RUNS'),
  path.join(ROOT, 'qa_phase7_runtime_forensics', 'QA_RUNS'),
  path.join(ROOT, 'qa_phase6_runtime_sync', 'QA_RUNS'),
  path.join(ROOT, 'qa_runs'),
  path.join(ROOT, 'baseline_runs'),
  path.join(ROOT, 'stress_runs'),
  path.join(ROOT, 'regression_runs'),
  path.join(ROOT, 'nightly_runs'),
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(filePath) {
  try {
    const raw = fs.readFileSync(filePath);
    if (!raw || raw.length === 0) return '';
    const utf8 = raw.toString('utf8');
    if (!utf8.includes('\u0000')) return utf8;
    return raw.toString('utf16le');
  } catch {
    return '';
  }
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(readText(filePath));
  } catch {
    return fallback;
  }
}

function walk(dir, matcher, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, matcher, out);
      continue;
    }

    if (matcher(full)) out.push(full);
  }

  return out;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function avg(values = []) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + toNumber(value, 0), 0) / values.length;
}

function std(values = []) {
  if (values.length <= 1) return 0;
  const mean = avg(values);
  const variance = avg(values.map((value) => (toNumber(value, 0) - mean) ** 2));
  return Math.sqrt(variance);
}

function parseDotEnv(dotEnvPath) {
  const out = {};
  if (!fs.existsSync(dotEnvPath)) return out;

  const lines = readText(dotEnvPath).split(/\r?\n/);
  for (const line of lines) {
    const safe = String(line || '').trim();
    if (!safe || safe.startsWith('#') || !safe.includes('=')) continue;

    const index = safe.indexOf('=');
    const key = safe.slice(0, index).trim();
    const value = safe.slice(index + 1).trim();
    out[key] = value;
  }

  return out;
}

function envValue(envMap, key) {
  const value = String(envMap?.[key] || '').trim();
  return value;
}

function isPlaceholder(value) {
  const safe = String(value || '').trim().toLowerCase();
  if (!safe) return true;
  return (
    safe.includes('replace_with_')
    || safe.includes('seu_')
    || safe === 'sua_key'
    || safe === 'id'
    || safe === 'app_id'
    || safe === 'change_this_password'
    || safe === 'change_this_secret'
  );
}

function buildConfigAudit() {
  const appJson = readJson(path.join(ROOT, 'app.json'), {});
  const easJson = readJson(path.join(ROOT, 'eas.json'), {});
  const googleServices = readJson(path.join(ROOT, 'android', 'app', 'google-services.json'), {});
  const manifestText = readText(path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'));
  const gradleText = readText(path.join(ROOT, 'android', 'app', 'build.gradle'));
  const envMap = parseDotEnv(path.join(ROOT, '.env'));

  const expo = appJson?.expo || {};
  const android = expo?.android || {};

  const googleOauthClients = Array.isArray(googleServices?.client?.[0]?.oauth_client)
    ? googleServices.client[0].oauth_client.length
    : 0;

  const requiredEnvKeys = [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_GOOGLE_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
  ];

  const envChecks = requiredEnvKeys.map((key) => {
    const value = envValue(envMap, key);
    const configured = !isPlaceholder(value);
    return { key, configured };
  });

  const missingEnv = envChecks.filter((item) => !item.configured).map((item) => item.key);

  const hasGoogleServicesPlugin = gradleText.includes("com.google.gms.google-services");
  const hasInternetPermission = manifestText.includes('android.permission.INTERNET');
  const hasPostNotifications = manifestText.includes('android.permission.POST_NOTIFICATIONS');
  const hasIntentViewHttps = manifestText.includes('android.intent.action.VIEW') && manifestText.includes('android:scheme="https"');
  const hasExpoWebBrowserPlugin = Array.isArray(expo?.plugins) && expo.plugins.includes('expo-web-browser');

  const versionCodeMatch = gradleText.match(/versionCode\s+(\d+)/i);
  const versionNameMatch = gradleText.match(/versionName\s+"([^"]+)"/i);

  return {
    appName: String(expo?.name || ''),
    appSlug: String(expo?.slug || ''),
    appVersion: String(expo?.version || ''),
    androidPackage: String(android?.package || ''),
    easProjectId: String(expo?.extra?.eas?.projectId || ''),
    buildVersionCode: toNumber(versionCodeMatch?.[1], 0),
    buildVersionName: String(versionNameMatch?.[1] || ''),
    hasGoogleServicesPlugin,
    googleProjectId: String(googleServices?.project_info?.project_id || ''),
    googleOauthClients,
    hasInternetPermission,
    hasPostNotifications,
    hasIntentViewHttps,
    hasExpoWebBrowserPlugin,
    envChecks,
    missingEnv,
    blockers: [
      ...(missingEnv.length > 0 ? [`variaveis .env ausentes/placeholder: ${missingEnv.join(', ')}`] : []),
      ...(googleOauthClients <= 0 ? ['google-services.json sem oauth_client; risco alto para Google Sign-In real'] : []),
      ...(!hasIntentViewHttps ? ['intent filter de deep link incompleto para fluxo OAuth'] : []),
    ],
  };
}

function parseReport(reportPath) {
  const text = readText(reportPath);
  const status = (text.match(/\*\*Status:\*\*\s*([A-Z]+)/i)?.[1] || 'UNKNOWN').toUpperCase();
  const durationSec = toNumber(text.match(/\*\*Duracao[^:]*:\*\*\s*([0-9.]+)s/i)?.[1], 0);
  const safe = reportPath.replace(/\\/g, '/').toLowerCase();

  let flow = 'other';
  if (safe.includes('smoke')) flow = 'cold_start';
  else if (safe.includes('cycle')) flow = 'warm_start';
  else if (safe.includes('regression')) flow = 'regression';
  else if (safe.includes('stress')) flow = 'stress';
  else if (safe.includes('nightly')) flow = 'long_session';

  return {
    reportPath,
    status,
    durationSec,
    flow,
  };
}

function collectSignals(logText) {
  const lines = String(logText || '').split(/\r?\n/);
  const out = {
    authLogs: 0,
    authErrors: 0,
    googleLoginAttempts: 0,
    firebaseAuthSignals: 0,
    playerFullscreen: 0,
    playerBuffering: 0,
    crashSignals: 0,
    runtimeBusy: 0,
    runtimeIdle: 0,
    networkErrors: 0,
    reconnectSignals: 0,
  };

  for (const line of lines) {
    const safe = String(line || '').toLowerCase();
    if (!safe) continue;

    if (safe.includes('[auth]')) out.authLogs += 1;
    if (safe.includes('login google') || safe.includes('/auth/google') || safe.includes('google auth')) out.googleLoginAttempts += 1;
    if (safe.includes('firebase') && safe.includes('auth')) out.firebaseAuthSignals += 1;
    if (safe.includes('[auth]') && (safe.includes('error') || safe.includes('falha') || safe.includes('erro'))) out.authErrors += 1;
    if (safe.includes('fullscreen')) out.playerFullscreen += 1;
    if (safe.includes('buffering')) out.playerBuffering += 1;
    if (safe.includes('fatal') || safe.includes('exception') || safe.includes('crash')) out.crashSignals += 1;
    if (safe.includes('app_runtime_busy')) out.runtimeBusy += 1;
    if (safe.includes('app_runtime_idle')) out.runtimeIdle += 1;
    if (safe.includes('[api][error]') || safe.includes('network') && safe.includes('error')) out.networkErrors += 1;
    if (safe.includes('reconnect') || safe.includes('restore session')) out.reconnectSignals += 1;
  }

  return out;
}

function mergeSignals(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    target[key] = toNumber(target[key], 0) + toNumber(value, 0);
  }
}

function classifyBugs(configAudit, reports, signals) {
  const bugRows = [];

  if (configAudit.googleOauthClients <= 0) {
    bugRows.push({ type: 'Google Sign-In oauth_client ausente', qty: 1, severity: 'critico', status: 'aberto' });
  }

  if (configAudit.missingEnv.length > 0) {
    bugRows.push({ type: 'Variaveis .env faltantes/placeholder', qty: configAudit.missingEnv.length, severity: 'alto', status: 'aberto' });
  }

  if (signals.authErrors > 0) {
    bugRows.push({ type: 'Erros de auth em runtime logs', qty: signals.authErrors, severity: 'alto', status: 'investigar' });
  }

  const failed = reports.filter((report) => report.status === 'FAIL').length;
  if (failed > 0) {
    bugRows.push({ type: 'Falhas de suites automatizadas', qty: failed, severity: 'medio', status: 'aberto' });
  }

  if (signals.playerBuffering > 0) {
    bugRows.push({ type: 'Eventos de buffering player', qty: signals.playerBuffering, severity: 'medio', status: 'monitorar' });
  }

  if (signals.crashSignals > 0) {
    bugRows.push({ type: 'Sinais de crash/excecao em logs', qty: signals.crashSignals, severity: 'alto', status: 'investigar' });
  }

  if (bugRows.length === 0) {
    bugRows.push({ type: 'Nenhum bug crítico explícito no parser', qty: 0, severity: 'baixo', status: 'observacao' });
  }

  return bugRows;
}

function reportLinesForRuns(reports) {
  if (reports.length === 0) return ['- sem runs encontrados'];

  return reports
    .sort((a, b) => {
      const am = fs.existsSync(a.reportPath) ? fs.statSync(a.reportPath).mtimeMs : 0;
      const bm = fs.existsSync(b.reportPath) ? fs.statSync(b.reportPath).mtimeMs : 0;
      return bm - am;
    })
    .slice(0, 40)
    .map((report) => `- ${report.status} | ${report.flow} | ${report.durationSec.toFixed(1)}s | ${path.relative(ROOT, report.reportPath).replace(/\\/g, '/')}`);
}

function writeMd(filePath, lines) {
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function main() {
  ensureDir(OUT_ROOT);
  ensureDir(OUT_RUNS);

  const reportFiles = [];
  const logFiles = [];
  const screenshots = [];
  const videos = [];

  for (const src of RUN_SOURCES) {
    reportFiles.push(...walk(src, (filePath) => filePath.toLowerCase().endsWith('report.md')));
    logFiles.push(...walk(src, (filePath) => {
      const safe = filePath.toLowerCase();
      return safe.endsWith('.log') || safe.endsWith('logcat.txt') || safe.endsWith('jest-output.txt');
    }));
    screenshots.push(...walk(src, (filePath) => {
      const safe = filePath.toLowerCase();
      return safe.endsWith('.png') || safe.endsWith('.jpg') || safe.endsWith('.jpeg');
    }));
    videos.push(...walk(src, (filePath) => {
      const safe = filePath.toLowerCase();
      return safe.endsWith('.mp4') || safe.endsWith('.webm') || safe.endsWith('.mov');
    }));
  }

  const configAudit = buildConfigAudit();
  const reports = reportFiles.map(parseReport);

  const durations = reports
    .map((report) => toNumber(report.durationSec, 0))
    .filter((value) => value > 0);

  const passCount = reports.filter((report) => report.status === 'PASS').length;
  const failCount = reports.filter((report) => report.status === 'FAIL').length;

  const signals = {
    authLogs: 0,
    authErrors: 0,
    googleLoginAttempts: 0,
    firebaseAuthSignals: 0,
    playerFullscreen: 0,
    playerBuffering: 0,
    crashSignals: 0,
    runtimeBusy: 0,
    runtimeIdle: 0,
    networkErrors: 0,
    reconnectSignals: 0,
  };

  for (const logPath of logFiles) {
    mergeSignals(signals, collectSignals(readText(logPath)));
  }

  const bugRows = classifyBugs(configAudit, reports, signals);

  const blockerAbsolute = [
    ...(configAudit.googleOauthClients <= 0 ? ['Google Sign-In real bloqueado por oauth_client ausente em google-services.json'] : []),
    ...(configAudit.missingEnv.length > 0 ? [`Credenciais/env incompletas para fluxo real: ${configAudit.missingEnv.join(', ')}`] : []),
    ...(signals.googleLoginAttempts <= 0 ? ['Evidencia de login Google real ainda não encontrada nos logs coletados'] : []),
  ];

  const highRisks = [
    ...(failCount > 0 ? [`Suites com falhas: ${failCount}`] : []),
    ...(signals.authErrors > 0 ? [`Erros de auth em logs: ${signals.authErrors}`] : []),
    ...(signals.crashSignals > 0 ? [`Sinais de crash/excecao detectados: ${signals.crashSignals}`] : []),
  ];

  const futureRecommendations = [
    'Executar roteiro manual com credenciais reais (Google + email/senha) com operador humano presente para OTP/captcha.',
    'Rodar ciclo longo adicional com app release assinado e monitorar restore session apos relaunch.',
    'Consolidar SHA-1/SHA-256 da keystore de release no Firebase console e reconfirmar OAuth clients.',
  ];

  const confidenceScore = Math.max(0, Math.min(100,
    72
    - blockerAbsolute.length * 22
    - highRisks.length * 8
    + Math.min(10, passCount)
  ));

  const releaseState = blockerAbsolute.length > 0
    ? 'NAO_APROVADO'
    : highRisks.length > 0
      ? 'APROVADO_COM_RISCO'
      : 'APROVADO';

  writeMd(path.join(OUT_ROOT, 'FINAL_REAL_VALIDATION.md'), [
    '# FINAL REAL VALIDATION',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Escopo validado',
    '- Home, Treinos, Navegacao de abas/stacks, fluxo de player e regressao automatizada.',
    '- Execucoes reais em device via smoke/cycle/regression e tour de app com evidencias.',
    '- Runtime logs, network/auth/player/crash signals coletados e indexados.',
    '',
    '## Resultado de suites',
    `- reports analisados: ${reports.length}`,
    `- pass: ${passCount}`,
    `- fail: ${failCount}`,
    `- media de duracao (s): ${avg(durations).toFixed(2)}`,
    `- desvio de duracao (s): ${std(durations).toFixed(2)}`,
    '',
    '## Falhas restantes',
    ...(failCount > 0 ? [`- suites com falha: ${failCount}`] : ['- sem falhas automatizadas nesta janela de dados']),
    ...(blockerAbsolute.length > 0 ? blockerAbsolute.map((value) => `- BLOCKER: ${value}`) : ['- sem blocker absoluto de configuracao detectado pelo analyzer']),
  ]);

  writeMd(path.join(OUT_ROOT, 'AUTH_REAL_FLOW_REPORT.md'), [
    '# AUTH REAL FLOW REPORT',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Firebase / Google readiness',
    `- firebase project id (google-services): ${configAudit.googleProjectId || 'N/A'}`,
    `- oauth clients em google-services.json: ${configAudit.googleOauthClients}`,
    `- plugin google-services ativo no gradle: ${configAudit.hasGoogleServicesPlugin ? 'sim' : 'nao'}`,
    `- expo-web-browser plugin: ${configAudit.hasExpoWebBrowserPlugin ? 'sim' : 'nao'}`,
    '',
    '## Evidencia de auth em runtime',
    `- auth logs: ${signals.authLogs}`,
    `- tentativas login Google: ${signals.googleLoginAttempts}`,
    `- sinais firebase auth: ${signals.firebaseAuthSignals}`,
    `- erros de auth: ${signals.authErrors}`,
    '',
    '## Persistencia / restore / reconnect',
    `- reconnect signals: ${signals.reconnectSignals}`,
    '- Persistencia por SecureStore/MMKV permanece implementada no app; validacao manual real depende de credenciais ativas.',
    '',
    '## Status',
    ...(blockerAbsolute.length > 0 ? blockerAbsolute.map((value) => `- BLOCKER: ${value}`) : ['- fluxo de auth real sem bloqueio estrutural detectado']),
  ]);

  writeMd(path.join(OUT_ROOT, 'VIDEO_FULL_VALIDATION.md'), [
    '# VIDEO FULL VALIDATION',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Artefatos de video detectados',
    `- videos indexados: ${videos.length}`,
    `- screenshots indexados: ${screenshots.length}`,
    '',
    '## Sinais de player/lifecycle',
    `- fullscreen events: ${signals.playerFullscreen}`,
    `- buffering events: ${signals.playerBuffering}`,
    `- runtime busy anchors: ${signals.runtimeBusy}`,
    `- runtime idle anchors: ${signals.runtimeIdle}`,
    '',
    '## Validacao de fluxo continuo',
    '- O runner phase8 prepara captura de video continuo durante tour completo do app (sem cortes no processo automatizado).',
    '- Validacao final humana deve confirmar visualmente login real + CRUD + restore session no video gerado.',
  ]);

  writeMd(path.join(OUT_ROOT, 'RELEASE_READINESS_REVIEW.md'), [
    '# RELEASE READINESS REVIEW',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    `## Estado geral: ${releaseState}`,
    `- confidence score: ${confidenceScore}/100`,
    '',
    '## Estabilidade e saude',
    `- crash signals: ${signals.crashSignals}`,
    `- network errors: ${signals.networkErrors}`,
    `- runtime busy signals: ${signals.runtimeBusy}`,
    `- runtime idle signals: ${signals.runtimeIdle}`,
    '',
    '## Blockers absolutos',
    ...(blockerAbsolute.length > 0 ? blockerAbsolute.map((value) => `- ${value}`) : ['- nenhum blocker absoluto identificado nesta analise']),
    '',
    '## Riscos altos',
    ...(highRisks.length > 0 ? highRisks.map((value) => `- ${value}`) : ['- nenhum risco alto adicional detectado']),
    '',
    '## Recomendacoes futuras',
    ...futureRecommendations.map((value) => `- ${value}`),
  ]);

  writeMd(path.join(OUT_ROOT, 'FINAL_BUG_TRIAGE.md'), [
    '# FINAL BUG TRIAGE',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '| Tipo | Quantidade | Gravidade | Status |',
    '| ---- | ---------- | --------- | ------ |',
    ...bugRows.map((row) => `| ${row.type} | ${row.qty} | ${row.severity} | ${row.status} |`),
  ]);

  writeMd(path.join(OUT_RUNS, 'README.md'), [
    '# QA RUNS - PHASE 8 PRODUCTION READINESS',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Reports scanned: ${reports.length}`,
    `Logs scanned: ${logFiles.length}`,
    `Screenshots indexed: ${screenshots.length}`,
    `Videos indexed: ${videos.length}`,
    '',
    '## Latest Runs',
    ...reportLinesForRuns(reports),
  ]);

  fs.writeFileSync(path.join(OUT_RUNS, 'artifacts_manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    reports: reportFiles.map((value) => path.relative(ROOT, value).replace(/\\/g, '/')),
    logs: logFiles.map((value) => path.relative(ROOT, value).replace(/\\/g, '/')),
    screenshots: screenshots.map((value) => path.relative(ROOT, value).replace(/\\/g, '/')),
    videos: videos.map((value) => path.relative(ROOT, value).replace(/\\/g, '/')),
    configAudit,
    signals,
    blockerAbsolute,
    highRisks,
    releaseState,
    confidenceScore,
  }, null, 2));

  console.log('[phase8] production readiness reports generated');
  console.log(`[phase8] reports=${reports.length} logs=${logFiles.length} videos=${videos.length} blockers=${blockerAbsolute.length}`);
}

main();
