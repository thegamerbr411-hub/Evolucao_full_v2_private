'use strict';

/**
 * catalog.js
 * Persistência de catálogo (submissions, exercise_catalog, machine_catalog).
 * Usa arquivo local como banco de dados (fallback se Firebase não disponível).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'artifacts');
const CATALOG_PATH = path.join(ARTIFACTS_DIR, 'catalog-submissions.json');
const EXERCISE_CATALOG_PATH = path.join(ARTIFACTS_DIR, 'exercise-catalog.json');
const MACHINE_CATALOG_PATH = path.join(ARTIFACTS_DIR, 'machine-catalog.json');

const MAX_SUBMISSIONS = 5000;
const MAX_OFFICIAL = 10000;

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let firebaseCatalog = null;

function getFirebaseCatalogAdapter() {
  if (firebaseCatalog !== null) {
    return firebaseCatalog;
  }

  firebaseCatalog = { enabled: false };

  const enabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.CATALOG_FIREBASE_ENABLED || '').toLowerCase());
  if (!enabled) {
    return firebaseCatalog;
  }

  try {
    const admin = require('firebase-admin');
    const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
    const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    const privateKeyRaw = String(process.env.FIREBASE_PRIVATE_KEY || '').trim();
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return firebaseCatalog;
    }

    const app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });

    const db = admin.firestore(app);
    firebaseCatalog = {
      enabled: true,
      db,
    };
    return firebaseCatalog;
  } catch {
    return firebaseCatalog;
  }
}

async function mirrorToFirebase(collectionName, docId, payload) {
  const adapter = getFirebaseCatalogAdapter();
  if (!adapter.enabled) return false;
  try {
    await adapter.db.collection(collectionName).doc(String(docId)).set(payload, { merge: true });
    return true;
  } catch {
    return false;
  }
}

function ensureDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function generateId(prefix = 'cat') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// ── Submissions store ─────────────────────────────────────────────────────────

function readSubmissions() {
  ensureDir();
  if (!fs.existsSync(CATALOG_PATH)) {
    return { version: 1, submissions: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch {
    return { version: 1, submissions: [] };
  }
}

function writeSubmissions(store) {
  ensureDir();
  if (store.submissions.length > MAX_SUBMISSIONS) {
    store.submissions = store.submissions.slice(-MAX_SUBMISSIONS);
  }
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// ── Exercise catalog store ────────────────────────────────────────────────────

function readExerciseCatalog() {
  ensureDir();
  if (!fs.existsSync(EXERCISE_CATALOG_PATH)) {
    return { version: 1, items: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(EXERCISE_CATALOG_PATH, 'utf8'));
  } catch {
    return { version: 1, items: [] };
  }
}

function writeExerciseCatalog(store) {
  ensureDir();
  if (store.items.length > MAX_OFFICIAL) {
    store.items = store.items.slice(-MAX_OFFICIAL);
  }
  fs.writeFileSync(EXERCISE_CATALOG_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// ── Machine catalog store ─────────────────────────────────────────────────────

function readMachineCatalog() {
  ensureDir();
  if (!fs.existsSync(MACHINE_CATALOG_PATH)) {
    return { version: 1, items: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(MACHINE_CATALOG_PATH, 'utf8'));
  } catch {
    return { version: 1, items: [] };
  }
}

function writeMachineCatalog(store) {
  ensureDir();
  if (store.items.length > MAX_OFFICIAL) {
    store.items = store.items.slice(-MAX_OFFICIAL);
  }
  fs.writeFileSync(MACHINE_CATALOG_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Cria uma nova submissão de catálogo.
 */
function createSubmission({ title, description, type, muscleGroup, equipment, difficulty, source, createdBy, analysis }) {
  const store = readSubmissions();
  const id = generateId('sub');
  const now = new Date().toISOString();

  const submission = {
    id,
    type: String(type || 'exercise'),
    title: String(title || ''),
    description: String(description || ''),
    muscleGroup: String(muscleGroup || ''),
    equipment: String(equipment || ''),
    difficulty: String(difficulty || 'intermediate'),
    source: String(source || 'admin'),
    createdBy: String(createdBy || 'admin'),
    status: 'pending',
    analysis: analysis || null,
    createdAt: now,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
  };

  store.submissions.push(submission);
  writeSubmissions(store);
  mirrorToFirebase('catalog_submissions', id, submission);
  return submission;
}

/**
 * Lista submissões por status.
 */
function listSubmissions({ status = null, limit = 200 } = {}) {
  const store = readSubmissions();
  let items = store.submissions || [];
  if (status) {
    items = items.filter((item) => item.status === status);
  }
  return items.slice(-limit).reverse();
}

/**
 * Busca submissão por id.
 */
function getSubmission(id) {
  const store = readSubmissions();
  return store.submissions.find((item) => item.id === id) || null;
}

/**
 * Aprova uma submissão e move para o catálogo oficial.
 */
function approveSubmission(id, { reviewedBy = 'admin' } = {}) {
  const store = readSubmissions();
  const idx = store.submissions.findIndex((item) => item.id === id);
  if (idx < 0) return null;

  const submission = store.submissions[idx];
  if (submission.status !== 'pending') {
    return null;
  }

  submission.status = 'approved';
  submission.reviewedAt = new Date().toISOString();
  submission.reviewedBy = String(reviewedBy || 'admin');
  store.submissions[idx] = submission;
  writeSubmissions(store);

  const now = new Date().toISOString();

  if (submission.type === 'machine') {
    const machineStore = readMachineCatalog();
    const exists = machineStore.items.some(
      (item) => normalizeTitle(item.title) === normalizeTitle(submission.title)
    );
    if (!exists) {
      const machineItem = {
        id: generateId('mac'),
        title: submission.title,
        description: submission.description,
        category: (submission.analysis || {}).suggestedCategory || 'musculacao',
        approvedAt: now,
        approvedBy: reviewedBy,
        active: true,
      };
      machineStore.items.push(machineItem);
      writeMachineCatalog(machineStore);
      mirrorToFirebase('machine_catalog', machineItem.id, machineItem);
    }
  } else {
    const exerciseStore = readExerciseCatalog();
    const exists = exerciseStore.items.some(
      (item) => normalizeTitle(item.title) === normalizeTitle(submission.title)
    );
    if (!exists) {
      const exerciseItem = {
        id: generateId('exc'),
        type: submission.type,
        title: submission.title,
        description: submission.description,
        muscleGroup: (submission.analysis || {}).suggestedMuscleGroup || submission.muscleGroup || 'geral',
        equipment: (submission.analysis || {}).suggestedEquipment || submission.equipment || 'livre',
        difficulty: submission.difficulty,
        approvedAt: now,
        approvedBy: reviewedBy,
        active: true,
      };
      exerciseStore.items.push(exerciseItem);
      writeExerciseCatalog(exerciseStore);
      mirrorToFirebase('exercise_catalog', exerciseItem.id, exerciseItem);
    }
  }

  mirrorToFirebase('catalog_submissions', submission.id, submission);

  return submission;
}

/**
 * Recusa uma submissão.
 */
function rejectSubmission(id, { reviewedBy = 'admin', rejectionReason = '' } = {}) {
  const store = readSubmissions();
  const idx = store.submissions.findIndex((item) => item.id === id);
  if (idx < 0) return null;

  const submission = store.submissions[idx];
  if (submission.status !== 'pending') {
    return null;
  }

  submission.status = 'rejected';
  submission.reviewedAt = new Date().toISOString();
  submission.reviewedBy = String(reviewedBy || 'admin');
  submission.rejectionReason = String(rejectionReason || 'Recusado pelo administrador.');
  store.submissions[idx] = submission;
  writeSubmissions(store);
  mirrorToFirebase('catalog_submissions', submission.id, submission);
  return submission;
}

/**
 * Retorna o catálogo oficial (exercícios + máquinas).
 */
function getOfficialCatalog({ type = null } = {}) {
  const exercises = readExerciseCatalog().items.filter((item) => item.active !== false);
  const machines = readMachineCatalog().items.filter((item) => item.active !== false);

  if (type === 'exercise') return { exercises, machines: [] };
  if (type === 'machine') return { exercises: [], machines };
  return { exercises, machines };
}

/**
 * Retorna títulos normalizados do catálogo oficial para detecção de duplicados.
 */
function getOfficialTitles() {
  const { exercises, machines } = getOfficialCatalog();
  return [
    ...exercises.map((item) => normalizeTitle(item.title)),
    ...machines.map((item) => normalizeTitle(item.title)),
  ];
}

function getPendingTitles() {
  const pending = listSubmissions({ status: 'pending', limit: 2000 });
  return pending.map((item) => normalizeTitle(item.title));
}

module.exports = {
  createSubmission,
  listSubmissions,
  getSubmission,
  approveSubmission,
  rejectSubmission,
  getOfficialCatalog,
  getOfficialTitles,
  getPendingTitles,
  normalizeTitle,
};
