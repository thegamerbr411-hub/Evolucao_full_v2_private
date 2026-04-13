const fs = require('fs');
const path = require('path');

const { readStoreSync, writeStoreSync, getTenant, normalizeClientId } = require('../dashboard/src/server/storage');

function main() {
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
