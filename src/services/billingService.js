import { normalizePlanName } from './saasService.js';

export const getPlanName = (user = {}) => {
  return normalizePlanName(user?.plan || user?.planStatus || 'free');
};

export const isPro = (user = {}) => {
  const plan = getPlanName(user);
  return plan === 'pro' || plan === 'team';
};
