const fs = require('fs');
const path = require('path');

const { buildInsightsPayload } = require('../src/server/analysis');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'artifacts');
const BUGS_FILE = path.join(ARTIFACTS_DIR, 'learning.json');
const OUT = path.join(ARTIFACTS_DIR, 'insights.json');

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function main() {
  ensureArtifactsDir();
  const raw = readJson(BUGS_FILE, { tenants: {} });
  const tenants = raw?.tenants && typeof raw.tenants === 'object'
    ? raw.tenants
    : {
        default: {
          bugs: Array.isArray(raw?.bugs) ? raw.bugs : Array.isArray(raw) ? raw : [],
        },
      };

  const payload = {
    generatedAt: new Date().toISOString(),
    tenants: {},
    totalInsights: 0,
    insights: [],
  };

  Object.entries(tenants).forEach(([clientId, tenant]) => {
    const bugs = Array.isArray(tenant?.bugs) ? tenant.bugs : [];
    const report = buildInsightsPayload(clientId, bugs);
    payload.tenants[clientId] = report;
    payload.totalInsights += report.totalInsights;
    payload.insights.push(...report.insights.map((item) => ({ clientId, ...item })));
  });

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`ai-analyze:ok ${payload.totalInsights} insight(s)`);
}

main();
