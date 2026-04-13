const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { startServer } = require('../dashboard/server');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const CLIENT_ID = process.env.QA_CLIENT_ID || 'admin';
const MAX_GENERATED = Math.max(1, Math.min(3, Number(process.env.AI_GENERATED_LIMIT || 3)));
const OUT_DIR = path.resolve(__dirname, '..', 'e2e', 'generated');
const INDEX_FILE = path.join(OUT_DIR, 'index.json');

function hash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 10);
}

async function getBugs() {
  const response = await fetch(`${BASE_URL}/api/bugs?limit=50`, {
    headers: {
      'x-qa-client-id': CLIENT_ID,
      'x-qa-local': '1',
    },
  });

  if (!response.ok) {
    throw new Error(`bugs_fetch_failed_${response.status}`);
  }

  return response.json();
}

async function isApiUp() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload?.status === 'ok';
  } catch {
    return false;
  }
}

function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  } catch {
    return { generated: [] };
  }
}

function writeIndex(index) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

function buildTestContent(bug, testName) {
  const safeMessage = String(bug?.message || 'erro_sem_mensagem').replace(/'/g, '');
  const safeScreen = String(bug?.screen || 'unknown').replace(/'/g, '');

  return `describe('${testName}', () => {\n  it('valida estabilidade para bug gerado por IA', async () => {\n    await device.launchApp({ newInstance: true });\n    await expect(element(by.id('app-root'))).toBeVisible();\n\n    // alvo principal reportado: ${safeScreen}\n    await expect(element(by.id('app-root'))).toBeVisible();\n\n    // bug de referência: ${safeMessage}\n  });\n});\n`;
}

async function main() {
  let tempServer = null;

  if (!(await isApiUp()) && BASE_URL.includes('127.0.0.1')) {
    tempServer = startServer(3000);
    console.log('[ai-generate-tests] local API iniciada em fallback');
  }

  const bugs = await getBugs();
  const index = readIndex();
  const known = new Set((index.generated || []).map((item) => item.fingerprint));

  const candidates = Array.isArray(bugs)
    ? bugs.filter((bug) => bug?.fingerprint && !known.has(bug.fingerprint)).slice(0, MAX_GENERATED)
    : [];

  const generated = [];

  candidates.forEach((bug, idx) => {
    const slug = hash(`${bug.fingerprint}-${idx}`);
    const fileName = `gen-${slug}.e2e.js`;
    const filePath = path.join(OUT_DIR, fileName);
    const testName = `generated-${slug}`;

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(filePath, buildTestContent(bug, testName), 'utf-8');

    generated.push({
      fileName,
      fingerprint: bug.fingerprint,
      generatedAt: new Date().toISOString(),
      source: bug.message || 'unknown',
    });
  });

  index.generated = [...(index.generated || []), ...generated].slice(-1000);
  writeIndex(index);

  console.log(`[ai-generate-tests] generated=${generated.length} max=${MAX_GENERATED}`);

  if (tempServer) {
    await new Promise((resolve) => tempServer.close(resolve));
    console.log('[ai-generate-tests] local API finalizada');
  }
}

main().catch((error) => {
  console.error('[ai-generate-tests] fatal', error.message);
  process.exit(1);
});
