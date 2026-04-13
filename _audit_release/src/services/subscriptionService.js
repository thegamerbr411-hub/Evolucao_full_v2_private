import {
  getSubscriptionStatusFor,
  hasFeatureAccessFor,
  normalizeMonetization,
} from '../context/subscription/subscriptionService';

export function getSubscriptionSummary(monetization) {
  const normalized = normalizeMonetization(monetization);
  const status = getSubscriptionStatusFor(normalized);
  const plan = status.isPro ? 'premium' : 'free';

  return {
    subscriptionStatus: status.source,
    plan,
    upgradeAvailable: !status.isPro,
    trialRemainingDays: Number(status.trialRemainingDays || 0),
    isPremium: Boolean(status.isPro),
  };
}

export function canAccessPremiumFeature(monetization, featureKey) {
  return Boolean(hasFeatureAccessFor(monetization, featureKey));
}
