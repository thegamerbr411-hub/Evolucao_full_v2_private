/**
 * cloudQaService.js
 * Envia logs de QA para Firebase Firestore (quando configurado)
 * ou para o backend REST como fallback garantido.
 */

const QA_REST_URL = (
  (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_QA_API_BASE_URL)
  || (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_API_BASE_URL)
  || 'https://evolucao-api-dou2.onrender.com'
).replace(/\/$/, '');

const QA_CLIENT_ID = (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_QA_CLIENT_ID) || 'default';
const QA_API_KEY   = (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_QA_API_KEY)   || '';

// Firebase lazy init — so ativa quando ENV vars reais estiverem preenchidas
let _db          = null;
let _addDoc      = null;
let _collection  = null;
let _initialized = false;

function tryInitFirebase() {
  if (_initialized) return;
  _initialized = true;

  const apiKey = (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_FIREBASE_API_KEY) || '';
  if (!apiKey || /^replace_|^SUA_|^$/i.test(apiKey.trim())) return;

  try {
    const { initializeApp, getApps, getApp } = require('firebase/app');
    const { getFirestore, addDoc, collection } = require('firebase/firestore');

    const firebaseApp = getApps().length
      ? getApp()
      : initializeApp({
          apiKey,
          authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        || '',
          projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         || '',
          storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     || '',
          messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID|| '',
          appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             || '',
        });

    _db         = getFirestore(firebaseApp);
    _addDoc     = addDoc;
    _collection = collection;
  } catch {
    _db = null;
  }
}

// REST fallback — usa https nativo (sem dependencias extras)
async function sendToRest(endpoint, payload) {
  try {
    const https  = require('https');
    const http   = require('http');
    const body   = JSON.stringify(payload);
    const urlObj = new URL(endpoint, QA_REST_URL);
    const driver = urlObj.protocol === 'https:' ? https : http;

    await new Promise((resolve) => {
      const req = driver.request(
        {
          hostname: urlObj.hostname,
          port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path:     urlObj.pathname + urlObj.search,
          method:   'POST',
          headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
            'x-qa-local':     '1',
            'x-qa-client-id': QA_CLIENT_ID,
            ...(QA_API_KEY ? { 'x-api-key': QA_API_KEY } : {}),
          },
          timeout: 4000,
        },
        (res) => { res.resume(); res.on('end', resolve); }
      );
      req.on('error',   resolve);
      req.on('timeout', () => { try { req.destroy(); } catch {} resolve(); });
      req.write(body);
      req.end();
    });
  } catch {
    // nunca lanca — QA nao pode parar o app
  }
}

async function sendBugToCloud(bug) {
  tryInitFirebase();

  if (_db && _addDoc && _collection) {
    try {
      await _addDoc(_collection(_db, 'qa_logs'), { ...bug, createdAt: bug.createdAt || Date.now() });
      return;
    } catch {
      // cai no fallback
    }
  }

  await sendToRest('/api/log', {
    message:  String(bug.message || bug.msg || 'qa_bug'),
    screen:   String(bug.screen  || bug.scope || 'unknown'),
    stack:    String(bug.stack   || ''),
    severity: String(bug.severity || 'LOW'),
    meta:     bug.meta || {},
    clientId: QA_CLIENT_ID,
  });
}

async function sendChartToCloud(chart) {
  tryInitFirebase();

  if (_db && _addDoc && _collection) {
    try {
      await _addDoc(_collection(_db, 'qa_chart'), { data: chart, createdAt: Date.now() });
      return;
    } catch {
      // cai no fallback
    }
  }

  await sendToRest('/api/events', {
    type:      'qa_chart',
    payload:   chart,
    clientId:  QA_CLIENT_ID,
    createdAt: Date.now(),
  });
}

module.exports = { sendBugToCloud, sendChartToCloud };