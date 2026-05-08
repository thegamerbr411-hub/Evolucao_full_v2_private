/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'qa_phase9_final_blockers');
const RUNS_ROOT = path.join(OUT_ROOT, 'QA_RUNS');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(filePath) {
  try {
    const raw = fs.readFileSync(filePath);
    if (!raw || raw.length === 0) return '';
    const utf8 = raw.toString('utf8');
    if (!utf8.includes('\u0000')) return utf8.replace(/^\uFEFF/, '');
    return raw.toString('utf16le').replace(/^\uFEFF/, '');
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

function writeMd(filePath, lines) {
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFocusedRuns() {
  const focusedRoot = path.join(RUNS_ROOT, 'focused');
  const reportCandidates = walk(focusedRoot, (filePath) => filePath.toLowerCase().endsWith('report.md'));

  if (!reportCandidates.length) {
    return {
      reports: [],
      logs: [],
      tests: {
        social: { pass: 0, fail: 0 },
        treino: { pass: 0, fail: 0 },
        profile: { pass: 0, fail: 0 },
        paywall: { pass: 0, fail: 0 },
      },
      totalPass: 0,
      totalFail: 0,
    };
  }

  const latestReport = reportCandidates
    .map((filePath) => ({ filePath, mtime: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].filePath;

  const latestRunDir = path.dirname(latestReport);
  const reports = [latestReport];
  const logs = walk(path.join(latestRunDir, 'logs'), (filePath) => filePath.toLowerCase().endsWith('.log'));

  const focused = {
    reports,
    logs,
    tests: {
      social: { pass: 0, fail: 0 },
      treino: { pass: 0, fail: 0 },
      profile: { pass: 0, fail: 0 },
      paywall: { pass: 0, fail: 0 },
    },
    totalPass: 0,
    totalFail: 0,
  };

  for (const reportPath of reports) {
    const text = readText(reportPath).toLowerCase();
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (!line.includes('|') || !line.includes('.e2e.js')) continue;

      const normalized = line.replace(/\s+/g, ' ');
      const isPass = normalized.includes('| pass |');
      const isFail = normalized.includes('| fail |');
      if (!isPass && !isFail) continue;

      const bump = (bucket) => {
        if (isPass) {
          focused.tests[bucket].pass += 1;
          focused.totalPass += 1;
        }
        if (isFail) {
          focused.tests[bucket].fail += 1;
          focused.totalFail += 1;
        }
      };

      if (normalized.includes('13-social-ux-audit.e2e.js')) bump('social');
      if (normalized.includes('16-treino-tab-smoke.e2e.js')) bump('treino');
      if (normalized.includes('21-profile-save.e2e.js')) bump('profile');
      if (normalized.includes('22-paywall-trial.e2e.js')) bump('paywall');
    }
  }

  return focused;
}

function buildOAuthAudit() {
  const auditPath = path.join(RUNS_ROOT, 'oauth', 'oauth_audit.json');
  const oauth = readJson(auditPath, {});
  const appJson = readJson(path.join(ROOT, 'app.json'), {});
  const googleServices = readJson(path.join(ROOT, 'android', 'app', 'google-services.json'), {});
  const envText = readText(path.join(ROOT, '.env'));

  const envHasGoogleAndroid = /EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID\s*=\s*.+/i.test(envText);
  const envHasGoogleBase = /EXPO_PUBLIC_GOOGLE_CLIENT_ID\s*=\s*.+/i.test(envText);

  const oauthClients = Array.isArray(googleServices?.client?.[0]?.oauth_client)
    ? googleServices.client[0].oauth_client.length
    : 0;

  return {
    appName: String(appJson?.expo?.name || ''),
    appVersion: String(appJson?.expo?.version || ''),
    androidPackage: String(appJson?.expo?.android?.package || ''),
    oauthClients,
    debugSha1: String(oauth?.debugSha1 || '').trim(),
    debugSha256: String(oauth?.debugSha256 || '').trim(),
    keytoolAvailable: Boolean(oauth?.keytoolAvailable),
    envHasGoogleAndroid,
    envHasGoogleBase,
    humanGoogleLoginExecuted: null,
  };
}

function readHumanValidation() {
  const humanPath = path.join(RUNS_ROOT, 'human', 'human_validation_input.json');
  return readJson(humanPath, null);
}

function buildBlockers(flow, oauth, human) {
  const blockers = [];

  if (oauth.oauthClients <= 0) {
    blockers.push('google-services.json sem oauth_client valido para Google Sign-In real');
  }

  if (!oauth.envHasGoogleAndroid || !oauth.envHasGoogleBase) {
    blockers.push('EXPO_PUBLIC_GOOGLE_* incompleto no .env para fluxo OAuth real');
  }

  if (!oauth.keytoolAvailable || !oauth.debugSha1) {
    blockers.push('SHA-1 debug nao auditado (keytool/keystore indisponivel)');
  }

  if (!human || String(human.googleLoginExecuted || '').toLowerCase() !== 'sim') {
    blockers.push('validacao humana de Google OAuth real ainda nao comprovada');
  }

  if (flow.tests.social.fail > 0) blockers.push('flow social ainda falhando no ciclo focado');
  if (flow.tests.treino.fail > 0) blockers.push('flow treino-tab ainda falhando no ciclo focado');
  if (flow.tests.profile.fail > 0) blockers.push('flow profile-save ainda falhando no ciclo focado');
  if (flow.tests.paywall.fail > 0) blockers.push('flow paywall-trial ainda falhando no ciclo focado');

  return blockers;
}

function buildConfidence(flow, blockers, human) {
  let score = 85;
  score -= blockers.length * 12;
  score += Math.min(10, flow.totalPass * 2);
  score -= Math.min(20, flow.totalFail * 4);

  if (human && String(human.continuousVideoCaptured || '').toLowerCase() === 'sim') {
    score += 6;
  }

  score = Math.max(0, Math.min(100, score));

  const status = blockers.length > 0
    ? 'NAO_APROVADO'
    : flow.totalFail > 0
      ? 'APROVADO_COM_RISCO'
      : 'APROVADO';

  return { score, status };
}

function main() {
  ensureDir(OUT_ROOT);
  ensureDir(RUNS_ROOT);

  const flow = parseFocusedRuns();
  const oauth = buildOAuthAudit();
  const human = readHumanValidation();

  if (human) {
    oauth.humanGoogleLoginExecuted = String(human.googleLoginExecuted || '').toLowerCase() === 'sim';
  }

  const blockers = buildBlockers(flow, oauth, human);
  const confidence = buildConfidence(flow, blockers, human);

  writeMd(path.join(OUT_ROOT, 'GOOGLE_AUTH_REAL_VALIDATION.md'), [
    '# GOOGLE AUTH REAL VALIDATION',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Estado atual',
    `- app: ${oauth.appName || 'N/A'} v${oauth.appVersion || 'N/A'}`,
    `- pacote Android: ${oauth.androidPackage || 'N/A'}`,
    `- oauth_client em google-services.json: ${oauth.oauthClients}`,
    `- EXPO_PUBLIC_GOOGLE_CLIENT_ID presente: ${oauth.envHasGoogleBase ? 'sim' : 'nao'}`,
    `- EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID presente: ${oauth.envHasGoogleAndroid ? 'sim' : 'nao'}`,
    `- keytool disponivel: ${oauth.keytoolAvailable ? 'sim' : 'nao'}`,
    `- SHA1 debug detectado: ${oauth.debugSha1 || 'N/A'}`,
    `- SHA256 debug detectado: ${oauth.debugSha256 || 'N/A'}`,
    '',
    '## Validacao humana',
    `- login Google real executado por humano: ${human ? (human.googleLoginExecuted || 'nao informado') : 'nao evidenciado'}`,
    `- OTP/captcha solicitado: ${human ? (human.otpRequired || 'nao informado') : 'nao evidenciado'}`,
    `- OTP/captcha concluido: ${human ? (human.otpCompleted || 'nao informado') : 'nao evidenciado'}`,
    '',
    '## Resultado',
    ...(oauth.oauthClients > 0 && oauth.envHasGoogleAndroid && oauth.envHasGoogleBase
      ? ['- Configuracao base detectada para OAuth.']
      : ['- BLOCKER: configuracao OAuth base incompleta.']),
  ]);

  writeMd(path.join(OUT_ROOT, 'FLOW_BREAKERS_ANALYSIS.md'), [
    '# FLOW BREAKERS ANALYSIS',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Resultado por fluxo critico',
    `- social: pass=${flow.tests.social.pass} fail=${flow.tests.social.fail}`,
    `- treino-tab: pass=${flow.tests.treino.pass} fail=${flow.tests.treino.fail}`,
    `- profile-save: pass=${flow.tests.profile.pass} fail=${flow.tests.profile.fail}`,
    `- paywall-trial: pass=${flow.tests.paywall.pass} fail=${flow.tests.paywall.fail}`,
    '',
    '## Sintese',
    `- total pass: ${flow.totalPass}`,
    `- total fail: ${flow.totalFail}`,
    `- logs analisados: ${flow.logs.length}`,
    `- reports analisados: ${flow.reports.length}`,
    '',
    '## Diagnostico',
    ...(flow.totalFail > 0
      ? ['- Fluxos ainda apresentam falhas reais e precisam de nova rodada de fix+reteste.']
      : ['- Quatro fluxos criticos estabilizados no ciclo focado atual.']),
  ]);

  writeMd(path.join(OUT_ROOT, 'HUMAN_REAL_VALIDATION.md'), [
    '# HUMAN REAL VALIDATION',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Evidencia operacional',
    `- entrada humana encontrada: ${human ? 'sim' : 'nao'}`,
    `- operador: ${human ? (human.operator || 'nao informado') : 'N/A'}`,
    `- video continuo completo sem cortes: ${human ? (human.continuousVideoCaptured || 'nao informado') : 'nao evidenciado'}`,
    `- observacoes: ${human ? (human.notes || 'nenhuma') : 'nenhuma entrada humana registrada'}`,
    '',
    '## Nota',
    '- Para aprovacao final, manter evidencias manuais com operador presente em OAuth real (incluindo OTP/captcha quando aplicavel).',
  ]);

  writeMd(path.join(OUT_ROOT, 'FINAL_RELEASE_BLOCKERS.md'), [
    '# FINAL RELEASE BLOCKERS',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Blockers absolutos',
    ...(blockers.length > 0 ? blockers.map((item) => `- BLOCKER: ${item}`) : ['- sem blocker absoluto detectado no parser phase9']),
  ]);

  writeMd(path.join(OUT_ROOT, 'FINAL_RELEASE_CONFIDENCE.md'), [
    '# FINAL RELEASE CONFIDENCE',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    `- status: ${confidence.status}`,
    `- confidence score: ${confidence.score}/100`,
    `- blockers: ${blockers.length}`,
    `- fluxo pass: ${flow.totalPass}`,
    `- fluxo fail: ${flow.totalFail}`,
    '',
    '## Recomendacao',
    ...(confidence.status === 'APROVADO'
      ? ['- Release aprovado no escopo phase9.']
      : ['- Release nao aprovado: executar rodada adicional de fixes + validacao humana OAuth real.']),
  ]);

  const manifest = {
    generatedAt: new Date().toISOString(),
    reports: [
      'GOOGLE_AUTH_REAL_VALIDATION.md',
      'FLOW_BREAKERS_ANALYSIS.md',
      'HUMAN_REAL_VALIDATION.md',
      'FINAL_RELEASE_BLOCKERS.md',
      'FINAL_RELEASE_CONFIDENCE.md',
    ],
    qaRunsPath: 'qa_phase9_final_blockers/QA_RUNS',
    stats: {
      logs: flow.logs.length,
      reportFiles: flow.reports.length,
      blockers: blockers.length,
      confidence: confidence.score,
    },
  };

  fs.writeFileSync(path.join(RUNS_ROOT, 'artifacts_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  writeMd(path.join(RUNS_ROOT, 'README.md'), [
    '# QA RUNS - PHASE 9 FINAL BLOCKERS',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    `- focused reports: ${flow.reports.length}`,
    `- logs: ${flow.logs.length}`,
    `- blockers: ${blockers.length}`,
    `- confidence: ${confidence.score}/100`,
    '',
    '## Conteudo esperado',
    '- focused/run_<timestamp>/report.md',
    '- focused/run_<timestamp>/logs/*.log',
    '- oauth/oauth_audit.json',
    '- human/human_validation_input.json (quando HumanPrompt for usado)',
    '- video/*.mp4',
    '- artifacts_manifest.json',
  ]);

  console.log(`[phase9] reports=${flow.reports.length} logs=${flow.logs.length} blockers=${blockers.length} confidence=${confidence.score}`);
}

main();
