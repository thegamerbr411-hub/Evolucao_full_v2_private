// auto-fix-loop.js
// Loop automático para aplicar fix, retestar e decidir bugs
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.DASHBOARD_API_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const CLIENT_ID = process.env.CLIENT_ID || 'default';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_ATTEMPTS_PER_BUG = Math.max(1, Number(process.env.MAX_FIX_ATTEMPTS_PER_BUG || 3));
const MIN_FIX_CONFIDENCE = Number(process.env.MIN_FIX_CONFIDENCE || 0.72);
const LOOP_COOLDOWN_MS = Math.max(1000, Number(process.env.AUTO_FIX_LOOP_COOLDOWN_MS || 10000));
const MAX_CYCLES = Math.max(1, Number(process.env.AUTO_FIX_MAX_CYCLES || 120));
const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'artifacts');
const LOOP_HISTORY_FILE = path.join(ARTIFACTS_DIR, 'auto-fix-loop-history.json');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders() {
  return {
    'content-type': 'application/json',
    'x-qa-local': '1',
    'x-qa-client-id': CLIENT_ID,
    ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
  };
}

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function readLoopHistory() {
  try {
    return JSON.parse(fs.readFileSync(LOOP_HISTORY_FILE, 'utf-8'));
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      totalCycles: 0,
      entries: [],
    };
  }
}

function appendLoopHistory(entry) {
  ensureArtifactsDir();
  const history = readLoopHistory();
  history.generatedAt = new Date().toISOString();
  history.totalCycles = Number(history.totalCycles || 0) + 1;
  history.entries = Array.isArray(history.entries) ? history.entries : [];
  history.entries.push(entry);
  history.entries = history.entries.slice(-500);
  fs.writeFileSync(LOOP_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

async function getOpenBugs() {
  const res = await axios.get(`${BASE_URL}/api/bugs`, {
    headers: buildHeaders(),
    params: { limit: 10 },
  });
  return (res.data || []).filter((bug) => !bug.autoClosed && bug.status !== 'closed');
}

const { gerarPatchParaBug } = require('./openai-fix');
const CRITICAL_FILES = [
  'package.json', 'package-lock.json', 'yarn.lock', 'dashboard/server.js', 'src/server/auth.js', 'src/server/storage.js',
  '.env', 'eas.json', 'app.json', 'firestore.rules', 'android/app/build.gradle', 'android/build.gradle', 'gradlew', 'gradlew.bat'
];
const appliedFixes = new Set();
const bugAttempts = new Map();
const appliedPatchHashes = new Set();

function hashText(input) {
  let hash = 0;
  const text = String(input || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function getAttemptCount(fingerprint) {
  return Number(bugAttempts.get(fingerprint) || 0);
}

function increaseAttemptCount(fingerprint) {
  const next = getAttemptCount(fingerprint) + 1;
  bugAttempts.set(fingerprint, next);
  return next;
}

async function runPlaywrightTest() {
  // Executa teste Playwright e retorna { ok: boolean, confidence: number }
  const { execSync } = require('child_process');
  try {
    const output = execSync('npx playwright test playwright-dashboard.spec.js --reporter=json', { encoding: 'utf-8', timeout: 60000 });
    const result = JSON.parse(output);
    const passed = result.suites?.[0]?.tests?.every(t => t.status === 'passed');
    const confidence = passed ? 1.0 : 0.0;
    return { ok: passed, confidence };
  } catch (e) {
    return { ok: false, confidence: 0.0 };
  }
}

async function applyFix(bug) {
  // Não aplicar se já aplicou fix para esse bug
  if (appliedFixes.has(bug.fingerprint)) return { ok: false, reason: 'already_fixed' };
  if (getAttemptCount(bug.fingerprint) >= MAX_ATTEMPTS_PER_BUG) {
    return { ok: false, reason: 'max_attempts_reached', maxAttempts: MAX_ATTEMPTS_PER_BUG };
  }

  // Gera patch real via OpenAI
  let suggestion;
  try {
    suggestion = await gerarPatchParaBug(bug);
  } catch (e) {
    return { ok: false, reason: 'openai_error', error: e.message };
  }

  const patch = String(suggestion?.patch || '').trim();
  const confidence = Number(suggestion?.confidence || 0);
  const patchHash = hashText(patch);

  if (appliedPatchHashes.has(patchHash)) {
    return { ok: false, reason: 'duplicate_patch_blocked' };
  }

  // Extrai arquivo do patch (linha com *** Update File: ...)
  const match = patch.match(/\*\*\* Update File: (.+)/);
  if (!match) return { ok: false, reason: 'invalid_patch' };
  const file = match[1].trim();
  if (file.includes('..') || file.startsWith('/') || /^[A-Za-z]:\\/.test(file)) {
    return { ok: false, reason: 'unsafe_patch_path', file };
  }
  // Bloqueia arquivos críticos
  if (CRITICAL_FILES.some(f => file.endsWith(f))) {
    return { ok: false, reason: 'critical_file_blocked', file };
  }

  // Valida teste antes de aplicar novo fix
  const testBefore = await runPlaywrightTest();
  if (testBefore.ok) {
    // Se já está passando, não precisa fix
    return { ok: false, reason: 'test_already_ok' };
  }

  if (confidence < MIN_FIX_CONFIDENCE) return { ok: false, reason: 'low_confidence', confidence };

  // Aplica fix
  const payload = {
    file,
    change: patch,
    meta: {
      fingerprint: bug.fingerprint,
      confidence,
      aiModel: suggestion?.model || 'unknown',
      aiReason: suggestion?.reason || '',
      patchHash,
      attempt: getAttemptCount(bug.fingerprint) + 1,
    },
  };
  try {
    increaseAttemptCount(bug.fingerprint);
    const res = await axios.post(`${BASE_URL}/api/apply-fix`, payload, {
      headers: buildHeaders(),
      params: { clientId: CLIENT_ID },
    });
    appliedFixes.add(bug.fingerprint);
    appliedPatchHashes.add(patchHash);
    return res.data;
  } catch (e) {
    if (e.response && e.response.status === 409) return { ok: false, reason: 'already_applied' };
    throw e;
  }
}

async function getBugByFingerprint(fingerprint) {
  const res = await axios.get(`${BASE_URL}/api/bugs`, {
    headers: buildHeaders(),
    params: { limit: 100, clientId: CLIENT_ID },
  });
  const bugs = Array.isArray(res.data) ? res.data : [];
  return bugs.find((bug) => bug.fingerprint === fingerprint) || null;
}

async function retestBug(bug) {
  const payload = {
    fingerprint: bug.fingerprint,
    meta: { fingerprint: bug.fingerprint },
    mode: 'smoke',
  };
  await axios.post(`${BASE_URL}/api/retest`, payload, {
    headers: buildHeaders(),
    params: { clientId: CLIENT_ID },
  });
}

async function decideBug(bug) {
  const refreshedBug = await getBugByFingerprint(bug.fingerprint);
  const decision = refreshedBug?.resolved || refreshedBug?.status === 'closed' ? 'resolver' : 'rollback';
  await axios.post(`${BASE_URL}/api/bug-decision`, {
    fingerprint: bug.fingerprint,
    decision,
    reason: `auto-loop:${decision}`,
  }, {
    headers: buildHeaders(),
    params: { clientId: CLIENT_ID },
  });
}

async function mainLoop() {
  let loopCount = 0;
  while (loopCount < MAX_CYCLES) {
    try {
      const bugs = await getOpenBugs();
      const cycleEntry = {
        cycle: loopCount + 1,
        startedAt: new Date().toISOString(),
        openBugs: bugs.length,
        actions: [],
      };
      for (const bug of bugs) {
        // Só tenta fix se não aplicou antes
        if (appliedFixes.has(bug.fingerprint)) continue;
        const fixResult = await applyFix(bug);
        if (fixResult.ok) {
          cycleEntry.actions.push({
            action: 'apply-fix',
            fingerprint: bug.fingerprint,
            ok: true,
            confidence: Number(fixResult?.entry?.meta?.confidence || 0),
          });
          await retestBug(bug);
          await sleep(1200);
          await decideBug(bug);
        } else {
          // Loga motivo de não aplicar fix
          console.log(`[auto-fix-loop] Bug ${bug.fingerprint} não corrigido:`, fixResult.reason || fixResult.error);
          cycleEntry.actions.push({
            action: 'skip-fix',
            fingerprint: bug.fingerprint,
            ok: false,
            reason: String(fixResult.reason || fixResult.error || 'unknown'),
          });
        }
      }
      cycleEntry.finishedAt = new Date().toISOString();
      appendLoopHistory(cycleEntry);
    } catch (e) {
      console.error('[auto-fix-loop]', e.message);
      appendLoopHistory({
        cycle: loopCount + 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        openBugs: 0,
        actions: [],
        error: String(e.message || e),
      });
    }
    loopCount++;
    await sleep(LOOP_COOLDOWN_MS);
  }
  console.log('Loop automático finalizado (safety stop)');
}

mainLoop();
