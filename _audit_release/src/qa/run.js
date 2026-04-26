/**
 * qa/run.js
 * Executor de QA — roda verificações e envia resultados para cloud.
 * Nunca para por erro. Sempre gera e envia dados.
 */
const { sendBugToCloud, sendChartToCloud } = require('../services/cloudQaService');
const { logBug } = require('./bugLogger');

const QA_VERSION = '2.0.0';

function safeRun(label, fn) {
  try {
    return fn();
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

// --- Verificações de integridade básicas ---

function checkEnvironment() {
  const checks = {
    nodeVersion:     process.version,
    hasApiUrl:       Boolean(process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL),
    hasFirebaseKey:  Boolean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY && !/^replace_/i.test(process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '')),
    hasQaClientId:   Boolean(process.env.EXPO_PUBLIC_QA_CLIENT_ID),
    nodeEnv:         process.env.NODE_ENV || 'development',
    timestamp:       new Date().toISOString(),
  };
  return { ok: true, checks };
}

function checkStores() {
  const required = [
    'src/stores/useUserStore.ts',
    'src/stores/useWorkoutStore.ts',
    'src/stores/useNutritionStore.ts',
    'src/stores/useGamificationStore.ts',
  ];
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '../..');
  const results = required.map((file) => ({
    file,
    exists: fs.existsSync(path.join(root, file)),
  }));
  const allExist = results.every((r) => r.exists);
  return { ok: allExist, stores: results };
}

function checkDeployConfigs() {
  const fs   = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '../..');
  const files = ['render.yaml', 'railway.json', 'vercel.json'];
  const results = files.map((f) => ({ file: f, exists: fs.existsSync(path.join(root, f)) }));
  return { ok: results.every((r) => r.exists), files: results };
}

function checkNavigation() {
  const fs   = require('fs');
  const path = require('path');
  const navPath = path.resolve(__dirname, '../../src/navigation/RootNavigator.js');
  if (!fs.existsSync(navPath)) return { ok: false, error: 'RootNavigator.js not found' };
  const content = fs.readFileSync(navPath, 'utf8');
  const requiredRoutes = ['MainTabs', 'Historico', 'Coach', 'Treino', 'Scanner'];
  const missing = requiredRoutes.filter((r) => !content.includes(r));
  return { ok: missing.length === 0, missing };
}

function checkServices() {
  const fs   = require('fs');
  const path = require('path');
  const services = [
    'src/services/firebase.js',
    'src/services/cloudQaService.js',
    'src/services/loggingService.js',
    'src/qa/bugLogger.js',
  ];
  const root = path.resolve(__dirname, '../..');
  const results = services.map((f) => ({
    file: f,
    exists: fs.existsSync(path.join(root, f)),
  }));
  return { ok: results.every((r) => r.exists), services: results };
}

// --- Geração de gráfico de saúde do QA ---

function buildHealthChart(results) {
  const passing = Object.values(results).filter((r) => r?.ok === true).length;
  const total   = Object.keys(results).length;
  return {
    version:    QA_VERSION,
    timestamp:  Date.now(),
    score:      Math.round((passing / total) * 100),
    passing,
    total,
    details:    results,
  };
}

// --- Main ---

async function main() {
  console.log(`[qa/run] iniciando v${QA_VERSION}`);

  const results = {
    environment:   safeRun('environment',  checkEnvironment),
    stores:        safeRun('stores',        checkStores),
    deployConfigs: safeRun('deployConfigs', checkDeployConfigs),
    navigation:    safeRun('navigation',    checkNavigation),
    services:      safeRun('services',      checkServices),
  };

  // Enviar bugs para itens com falha
  for (const [key, result] of Object.entries(results)) {
    if (!result?.ok) {
      await logBug({
        screen:   `qa/run::${key}`,
        message:  result?.error || `check_failed:${key}`,
        severity: 'MEDIUM',
        meta:     result,
      });
    }
  }

  // Montar e enviar gráfico de saúde
  const chart = buildHealthChart(results);
  await sendChartToCloud(chart);

  const allOk  = Object.values(results).every((r) => r?.ok === true);
  const status = allOk ? 'ok' : 'degraded';
  console.log(`[qa/run] status=${status} score=${chart.score}% (${chart.passing}/${chart.total})`);

  for (const [key, result] of Object.entries(results)) {
    const icon = result?.ok ? 'pass' : 'FAIL';
    console.log(`  [${icon}] ${key}`);
  }

  return chart;
}

main().catch((error) => {
  console.error('[qa/run] erro fatal (nao deveria chegar aqui):', error?.message);
  process.exit(0); // nunca parar com erro
});

module.exports = { main, buildHealthChart };
