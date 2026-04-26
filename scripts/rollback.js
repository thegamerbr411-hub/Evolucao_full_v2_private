const fs = require('fs');
const path = require('path');

const { readStoreSync, writeStoreSync, getTenant, normalizeClientId } = require('../dashboard/src/server/storage');

function runSloAutoRollback() {
  const baselineFile = path.resolve(__dirname, '..', 'qa', 'mobile-observability-baseline.json');
  if (!fs.existsSync(baselineFile)) {
    console.error('[rollback] slo_baseline_not_found', baselineFile);
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf-8'));
  const shouldRollback = Boolean(baseline?.errorBudget?.rollbackRecommended);
  const outPath = path.resolve(__dirname, '..', 'artifacts', 'rollback-last.json');

  fs.writeFileSync(outPath, JSON.stringify({
    mode: 'auto-slo',
    generatedAt: new Date().toISOString(),
    status: shouldRollback ? 'rollback' : 'hold',
    reason: shouldRollback
      ? String((baseline?.errorBudget?.breaches || []).join(';') || 'error_budget_breached')
      : 'error_budget_ok',
    baseline: {
      rates: baseline?.rates || {},
      slo: baseline?.slo || {},
      errorBudget: baseline?.errorBudget || {},
    },
  }, null, 2), 'utf-8');

  console.log('[rollback] auto-slo', shouldRollback ? 'rollback' : 'hold', outPath);
  process.exit(shouldRollback ? 2 : 0);
}

function main() {
  if (String(process.argv[2] || '').trim() === '--auto-slo') {
    runSloAutoRollback();
    return;
  }

  const clientId = normalizeClientId(process.argv[2] || process.env.DEFAULT_CLIENT_ID || 'default');
  const fingerprint = String(process.argv[3] || '').trim();

  if (!fingerprint) {
    console.error('[rollback] usage: node scripts/rollback.js <clientId> <fingerprint>');
    process.exit(1);
  }

  const store = readStoreSync();
  const tenant = getTenant(store, clientId);
  const bug = tenant.bugs.find((item) => item.fingerprint === fingerprint);

  if (!bug) {
    console.error('[rollback] bug_not_found', JSON.stringify({ clientId, fingerprint }));
    process.exit(2);
  }

  bug.status = 'rollback';
  bug.resolved = false;
  bug.autoClosed = false;
  bug.decision = 'rollback';
  bug.decisionAt = new Date().toISOString();
  bug.decisionBy = 'rollback-script';
  bug.decisionReason = 'manual_rollback';

  writeStoreSync(store);

  const outPath = path.resolve(__dirname, '..', 'artifacts', 'rollback-last.json');
  fs.writeFileSync(outPath, JSON.stringify({
    clientId,
    fingerprint,
    rolledBackAt: new Date().toISOString(),
    status: bug.status,
  }, null, 2), 'utf-8');

  console.log('[rollback] done', outPath);
}

main();
