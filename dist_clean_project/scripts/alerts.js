const fs = require('fs');
const path = require('path');

const LEARNING_FILE = path.resolve(__dirname, '..', 'artifacts', 'learning.json');
const OUTPUT_FILE = path.resolve(__dirname, '..', 'artifacts', 'alerts.json');

function loadLearning() {
  if (!fs.existsSync(LEARNING_FILE)) {
    return { tenants: {} };
  }

  try {
    return JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf-8'));
  } catch {
    return { tenants: {} };
  }
}

function buildAlerts(learning) {
  const alerts = [];
  Object.entries(learning.tenants || {}).forEach(([tenantId, data]) => {
    const risk = Array.isArray(data?.riskRanking) ? data.riskRanking : [];

    risk.slice(0, 20).forEach((item) => {
      if (item.riskScore >= 90 || item.priority === 'P0') {
        alerts.push({
          clientId: tenantId,
          fingerprint: item.fingerprint,
          level: 'critical',
          message: `Instabilidade alta em ${item.screen}`,
          riskScore: item.riskScore,
          screen: item.screen,
        });
      }
    });
  });

  return alerts;
}

function main() {
  const learning = loadLearning();
  const alerts = buildAlerts(learning);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    alerts,
    generatedAt: new Date().toISOString(),
    total: alerts.length,
  }, null, 2), 'utf-8');

  console.log('[alerts] generated', OUTPUT_FILE, `total=${alerts.length}`);
}

main();
