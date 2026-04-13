const crypto = require('crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' });

const db = admin.firestore();
const AI_DAILY_LIMIT = 5;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateUserScore(user = {}) {
  const xp = toNumber(user.xp, 0);
  const streak = toNumber(user.streakDays ?? user.streak, 0);
  const totalWorkouts = toNumber(user.totalWorkouts, 0);
  return xp + streak * 100 + totalWorkouts * 50;
}

async function writeLeaderboard() {
  const snapshot = await db.collection('users').get();
  const rows = snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    const score = calculateUserScore(data);
    return {
      userId: doc.id,
      displayName: String(data.displayName || data.name || 'Usuario'),
      photoURL: String(data.photoURL || ''),
      xp: toNumber(data.xp, 0),
      streakDays: toNumber(data.streakDays ?? data.streak, 0),
      totalWorkouts: toNumber(data.totalWorkouts, 0),
      score,
    };
  });

  rows.sort((a, b) => b.score - a.score || b.xp - a.xp || b.streakDays - a.streakDays);

  const batch = db.batch();
  rows.forEach((row, index) => {
    const ref = db.collection('leaderboard').doc(row.userId);
    batch.set(ref, {
      ...row,
      rank: index + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
  return { ok: true, total: rows.length };
}

function isAdminRequest(request) {
  return request.auth?.token?.admin === true;
}

function parseStripeSignature(headerValue = '') {
  const parts = String(headerValue || '').split(',').map((item) => item.trim());
  let timestamp = '';
  let v1 = '';

  parts.forEach((part) => {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') v1 = value;
  });

  return { timestamp, v1 };
}

function verifyStripeSignature(req, endpointSecret) {
  const signatureHeader = req.get('stripe-signature') || '';
  const { timestamp, v1 } = parseStripeSignature(signatureHeader);
  if (!timestamp || !v1 || !endpointSecret) {
    return false;
  }

  const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', endpointSecret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return expected === v1;
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseWorkoutTextFallback(text) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const exercises = [];

  lines.forEach((line) => {
    const lower = normalizeText(line);

    if (lower.includes('supino')) {
      exercises.push({ name: 'Supino', sets: [{ reps: '10', weight: '40', done: false }] });
    }

    if (lower.includes('leg')) {
      exercises.push({ name: 'Leg Press', sets: [{ reps: '12', weight: '100', done: false }] });
    }

    if (lower.includes('agach')) {
      exercises.push({ name: 'Agachamento Livre', sets: [{ reps: '10', weight: '60', done: false }] });
    }
  });

  return {
    name: 'Treino importado',
    exercises,
  };
}

exports.parseWorkout = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Auth obrigatoria.');
  }

  const data = request.data || {};
  const text = String(data.text || '');
  const imageUri = String(data.imageUri || '');
  const dayKey = new Date().toISOString().slice(0, 10);
  const hash = crypto
    .createHash('sha256')
    .update(`${uid}|${text}|${imageUri}`)
    .digest('hex');

  const cacheRef = db.collection('ai_cache').doc(hash);
  const usageRef = db.collection('ai_usage').doc(dayKey).collection('users').doc(uid);
  const userRef = db.collection('users').doc(uid);

  try {
    const [cacheSnap, usageSnap, userSnap] = await Promise.all([cacheRef.get(), usageRef.get(), userRef.get()]);

    if (cacheSnap.exists) {
      return {
        ...cacheSnap.data().payload,
        fromCache: true,
      };
    }

    const usageCount = Number(usageSnap.data()?.count || 0);
    const userAiUsage = userSnap.data()?.aiUsage || {};
    const userAiUsageToday = userAiUsage?.date === dayKey ? Number(userAiUsage?.count || 0) : 0;
    if (userAiUsageToday > 5) {
      throw new HttpsError('resource-exhausted', 'Limite diário atingido');
    }
    if (usageCount >= AI_DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Limite diario de IA atingido.');
    }

    const payload = parseWorkoutTextFallback(text);

    await db.runTransaction(async (tx) => {
      const usageCurrent = await tx.get(usageRef);
      const userCurrent = await tx.get(userRef);
      const currentCount = Number(usageCurrent.data()?.count || 0);
      const currentAiUsage = userCurrent.data()?.aiUsage || {};
      const currentUserCount = currentAiUsage?.date === dayKey ? Number(currentAiUsage?.count || 0) : 0;

      if (currentUserCount > 5) {
        throw new HttpsError('resource-exhausted', 'Limite diário atingido');
      }

      if (currentCount >= AI_DAILY_LIMIT) {
        throw new HttpsError('resource-exhausted', 'Limite diario de IA atingido.');
      }

      tx.set(usageRef, {
        count: currentCount + 1,
        updatedAt: Date.now(),
      }, { merge: true });

      tx.set(userRef, {
        aiUsage: {
          date: dayKey,
          count: currentUserCount + 1,
        },
      }, { merge: true });

      tx.set(cacheRef, {
        payload,
        userId: uid,
        hash,
        createdAt: Date.now(),
      });
    });

    return payload;
  } catch (error) {
    await db.collection('critical_logs').add({
      scope: 'functions.parseWorkout',
      userId: uid,
      message: String(error?.message || error),
      stack: String(error?.stack || ''),
      createdAt: Date.now(),
    });

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Falha ao processar treino.');
  }
});

exports.recalculateLeaderboard = onSchedule('every 60 minutes', async () => {
  await writeLeaderboard();
});

exports.recalculateLeaderboardManual = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Auth obrigatoria.');
  }

  if (!isAdminRequest(request)) {
    throw new HttpsError('permission-denied', 'Apenas admin pode recalcular leaderboard.');
  }

  return writeLeaderboard();
});

exports.stripeWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }

  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!verifyStripeSignature(req, endpointSecret)) {
      res.status(400).json({ ok: false, message: 'Invalid signature' });
      return;
    }

    const event = req.body || {};
    const eventType = String(event.type || '');
    const object = event?.data?.object || {};
    const userId = String(object?.metadata?.userId || object?.client_reference_id || '');
    const plan = String(object?.metadata?.plan || 'free').toLowerCase();

    if (!userId) {
      res.status(200).json({ ok: true, ignored: true, reason: 'missing_user' });
      return;
    }

    const isSuccess = eventType === 'checkout.session.completed' || eventType === 'invoice.paid';
    const isCanceled = eventType === 'customer.subscription.deleted' || eventType === 'invoice.payment_failed';

    if (isSuccess) {
      await db.collection('users').doc(userId).set({
        planStatus: 'active',
        plan,
        billingProvider: 'stripe',
        planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    if (isCanceled) {
      await db.collection('users').doc(userId).set({
        planStatus: 'inactive',
        plan: 'free',
        billingProvider: 'stripe',
        planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await db.collection('billing_events').add({
      eventType,
      userId,
      plan,
      payloadId: String(event.id || ''),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    await db.collection('critical_logs').add({
      scope: 'functions.stripeWebhook',
      message: String(error?.message || error),
      stack: String(error?.stack || ''),
      createdAt: Date.now(),
    });

    res.status(500).json({ ok: false, message: 'Webhook failure' });
  }
});
