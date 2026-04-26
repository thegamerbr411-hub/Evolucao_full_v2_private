/**
 * Suite de contrato — paywall / subscription
 * Cobre: trial, pro ativo, expiração, feature gating por entitlement real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MONETIZATION,
  normalizeMonetization,
  getSubscriptionStatusFor,
  hasFeatureAccessFor,
  withStartedProTrial,
  withActivatedProPlan,
} from '../src/context/subscription/subscriptionService.js';

// ---------------------------------------------------------------------------
// normalizeMonetization
// ---------------------------------------------------------------------------
test('normalizeMonetization retorna DEFAULT para entrada nula', () => {
  const result = normalizeMonetization(null);
  assert.deepStrictEqual(result, DEFAULT_MONETIZATION);
});

test('normalizeMonetization converte plano desconhecido para free', () => {
  const result = normalizeMonetization({ plan: 'unknown', trialDays: 7 });
  assert.strictEqual(result.plan, 'free');
  assert.strictEqual(result.trialDays, 7);
});

// ---------------------------------------------------------------------------
// getSubscriptionStatusFor — usuário free
// ---------------------------------------------------------------------------
test('usuario free sem trial: isPro=false, source=free', () => {
  const status = getSubscriptionStatusFor(DEFAULT_MONETIZATION);
  assert.strictEqual(status.isPro, false);
  assert.strictEqual(status.source, 'free');
  assert.strictEqual(status.trialRemainingDays, 0);
});

// ---------------------------------------------------------------------------
// getSubscriptionStatusFor — trial ativo
// ---------------------------------------------------------------------------
test('trial iniciado hoje: isPro=true, source=trial, dias restantes > 0', () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const monetization = { ...DEFAULT_MONETIZATION, trialStartedAt: todayKey, trialDays: 3 };
  const status = getSubscriptionStatusFor(monetization);

  assert.strictEqual(status.isPro, true);
  assert.strictEqual(status.source, 'trial');
  assert.ok(status.trialRemainingDays > 0, 'deve ter dias restantes');
});

// ---------------------------------------------------------------------------
// getSubscriptionStatusFor — trial expirado
// ---------------------------------------------------------------------------
test('trial expirado ha 5 dias: isPro=false, source=free', () => {
  const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const yyyy = past.getFullYear();
  const mm = String(past.getMonth() + 1).padStart(2, '0');
  const dd = String(past.getDate()).padStart(2, '0');
  const pastKey = `${yyyy}-${mm}-${dd}`;

  const monetization = { ...DEFAULT_MONETIZATION, trialStartedAt: pastKey, trialDays: 3 };
  const status = getSubscriptionStatusFor(monetization);

  assert.strictEqual(status.isPro, false);
  assert.strictEqual(status.source, 'free');
  assert.strictEqual(status.trialRemainingDays, 0);
});

// ---------------------------------------------------------------------------
// getSubscriptionStatusFor — plano PRO permanente
// ---------------------------------------------------------------------------
test('plano pro permanente: isPro=true, source=pro, trialRemainingDays=0', () => {
  const monetization = { plan: 'pro', trialStartedAt: null, trialDays: 3, proSince: '2026-01-01' };
  const status = getSubscriptionStatusFor(monetization);

  assert.strictEqual(status.isPro, true);
  assert.strictEqual(status.source, 'pro');
  assert.strictEqual(status.trialRemainingDays, 0);
});

// ---------------------------------------------------------------------------
// hasFeatureAccessFor — feature gating por entitlement
// ---------------------------------------------------------------------------
test('usuario free tem acesso a features gratuitas', () => {
  assert.strictEqual(hasFeatureAccessFor(DEFAULT_MONETIZATION, 'guided_workout'), true);
  assert.strictEqual(hasFeatureAccessFor(DEFAULT_MONETIZATION, 'sets_logging'), true);
  assert.strictEqual(hasFeatureAccessFor(DEFAULT_MONETIZATION, 'history_basic'), true);
});

test('usuario free NAO tem acesso a feature PRO', () => {
  // Qualquer feature que nao esteja na FREE_FEATURES deve ser bloqueada para free
  assert.strictEqual(hasFeatureAccessFor(DEFAULT_MONETIZATION, 'ai_coach_unlimited'), false);
  assert.strictEqual(hasFeatureAccessFor(DEFAULT_MONETIZATION, 'nutrition_premium'), false);
});

test('usuario PRO tem acesso a features exclusivas', () => {
  const proMonetization = { plan: 'pro', trialStartedAt: null, trialDays: 3, proSince: '2026-01-01' };
  assert.strictEqual(hasFeatureAccessFor(proMonetization, 'ai_coach_unlimited'), true);
  assert.strictEqual(hasFeatureAccessFor(proMonetization, 'nutrition_premium'), true);
});

// ---------------------------------------------------------------------------
// withStartedProTrial — imutabilidade e idempotencia
// ---------------------------------------------------------------------------
test('withStartedProTrial define trialStartedAt para hoje', () => {
  const result = withStartedProTrial(DEFAULT_MONETIZATION);
  assert.ok(result.trialStartedAt, 'deve ter trialStartedAt definido');
  assert.strictEqual(result.plan, 'free'); // plano nao muda ainda
});

test('withStartedProTrial e idempotente se trial ja iniciado', () => {
  const withTrial = withStartedProTrial(DEFAULT_MONETIZATION);
  const again = withStartedProTrial(withTrial);
  assert.strictEqual(again.trialStartedAt, withTrial.trialStartedAt, 'data de inicio nao deve mudar em segunda chamada');
});

test('withStartedProTrial nao altera objeto original', () => {
  const original = { ...DEFAULT_MONETIZATION };
  withStartedProTrial(original);
  assert.strictEqual(original.trialStartedAt, null, 'objeto original nao deve ser mutado');
});

// ---------------------------------------------------------------------------
// withActivatedProPlan — persistencia e valores
// ---------------------------------------------------------------------------
test('withActivatedProPlan define plan=pro e proSince', () => {
  const result = withActivatedProPlan(DEFAULT_MONETIZATION);
  assert.strictEqual(result.plan, 'pro');
  assert.ok(result.proSince, 'deve ter proSince definido');
});

test('withActivatedProPlan nao altera objeto original', () => {
  const original = { ...DEFAULT_MONETIZATION };
  withActivatedProPlan(original);
  assert.strictEqual(original.plan, 'free', 'objeto original nao deve ser mutado');
});
