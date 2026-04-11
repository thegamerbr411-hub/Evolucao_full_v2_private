const fs = require('fs');
const path = require('path');

const { analyzeBatch } = require('../dashboard/src/server/analysis');
const { readStoreSync } = require('../dashboard/src/server/storage');

const OUTPUT = path.resolve(__dirname, '..', 'artifacts', 'learning.json');

function rankByRisk(insights = []) {
  return insights
    .map((item) => ({
      action: String(item?.rootCause || 'unknown'),
      count: Number(item?.count || 0),
      fingerprint: String(item?.fingerprint || ''),
      priority: String(item?.priorityLabel || 'P3'),
      riskScore: Number(item?.priorityScore || 0),
      screen: String(item?.screen || 'unknown'),
      trend: String(item?.trend?.label || 'estavel'),
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 100);
}

function buildSummary(riskRanking = []) {
  const unstableScreens = {};
  const unstableActions = {};

  riskRanking.forEach((item) => {
    unstableScreens[item.screen] = Number(unstableScreens[item.screen] || 0) + item.riskScore;
    unstableActions[item.action] = Number(unstableActions[item.action] || 0) + item.riskScore;
  });

  const topScreens = Object.entries(unstableScreens)
    .map(([screen, score]) => ({ screen, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const topActions = Object.entries(unstableActions)
    .map(([action, score]) => ({ action, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return {
    topActions,
    topScreens,
  };
}

function main() {
  const store = readStoreSync();
  const tenants = Object.entries(store.tenants || {});

  const report = {
    generatedAt: new Date().toISOString(),
    tenants: {},
  };

  tenants.forEach(([tenantId, bucket]) => {
    const bugs = Array.isArray(bucket?.bugs) ? bucket.bugs : [];
    const analyzed = analyzeBatch(bugs);
    const riskRanking = rankByRisk(analyzed);

    report.tenants[tenantId] = {
      analyzed: analyzed.slice(0, 200),
      riskRanking,
      summary: buildSummary(riskRanking),
      totalBugs: bugs.length,
    };
  });

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log('[ai-brain] learning saved', OUTPUT);
}

main();
