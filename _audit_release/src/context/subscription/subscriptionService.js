export const DEFAULT_MONETIZATION = {
  plan: 'free',
  trialStartedAt: null,
  trialDays: 3,
  proSince: null,
};

const DEFAULT_TEST_PRO_CODE = 'EVO-PRO-TESTE-2026';

const FREE_FEATURES = new Set([
  'guided_workout',
  'free_workout',
  'sets_logging',
  'scanner_text',
  'history_basic',
  'xp_levels',
  'day_analysis',
]);

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeMonetization(raw) {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_MONETIZATION;
  }

  return {
    plan: raw.plan === 'pro' ? 'pro' : 'free',
    trialStartedAt: raw.trialStartedAt || null,
    trialDays: Number(raw.trialDays || 3),
    proSince: raw.proSince || null,
  };
}

export function getSubscriptionStatusFor(monetization) {
  const safe = normalizeMonetization(monetization);
  const isProPlan = safe.plan === 'pro';

  if (isProPlan) {
    return { isPro: true, source: 'pro', trialRemainingDays: 0 };
  }

  if (!safe.trialStartedAt) {
    return { isPro: false, source: 'free', trialRemainingDays: 0 };
  }

  const startDate = new Date(`${safe.trialStartedAt}T12:00:00`);
  const todayDate = new Date(`${getTodayKey()}T12:00:00`);
  const elapsed = Math.max(0, Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24)));
  const remaining = Math.max(0, Number(safe.trialDays || 3) - elapsed);

  return {
    isPro: remaining > 0,
    source: remaining > 0 ? 'trial' : 'free',
    trialRemainingDays: remaining,
  };
}

export function hasFeatureAccessFor(monetization, featureKey) {
  if (FREE_FEATURES.has(featureKey)) {
    return true;
  }

  return getSubscriptionStatusFor(monetization).isPro;
}

export function withStartedProTrial(monetization) {
  const safe = normalizeMonetization(monetization);
  if (safe.plan === 'pro' || safe.trialStartedAt) {
    return safe;
  }

  return {
    ...safe,
    trialStartedAt: getTodayKey(),
    trialDays: Number(safe.trialDays || 3),
  };
}

export function withActivatedProPlan(monetization) {
  const safe = normalizeMonetization(monetization);
  return {
    ...safe,
    plan: 'pro',
    proSince: getTodayKey(),
  };
}

export function getTestProCodes() {
  const fromEnv = String(
    (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_PRO_TEST_CODES : '') || ''
  )
    .split(',')
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (fromEnv.length > 0) {
    return Array.from(new Set(fromEnv));
  }

  return [DEFAULT_TEST_PRO_CODE];
}

export function isValidTestProCode(code) {
  const safeCode = String(code || '').trim();
  if (!safeCode) {
    return false;
  }

  const allowed = getTestProCodes();
  return allowed.includes(safeCode);
}

export function getDefaultTestProCode() {
  return getTestProCodes()[0] || DEFAULT_TEST_PRO_CODE;
}
