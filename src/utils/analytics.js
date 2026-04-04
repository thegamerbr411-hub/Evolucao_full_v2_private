const metrics = {
  paywall_open: 0,
  trial_start: 0,
  pro_activated: 0,
};

export const trackEvent = (name, data = {}) => {
  metrics[name] = (metrics[name] || 0) + 1;
  console.log('EVENT:', name, data, 'COUNT:', metrics[name]);

  // futuro:
  // firebase.analytics().logEvent(name, data);
};

export const getAnalyticsMetrics = () => {
  return { ...metrics };
};

export const getConversionRates = () => {
  const snapshot = getAnalyticsMetrics();

  const trialRate = snapshot.paywall_open
    ? (snapshot.trial_start / snapshot.paywall_open) * 100
    : 0;

  const proRate = snapshot.trial_start
    ? (snapshot.pro_activated / snapshot.trial_start) * 100
    : 0;

  return {
    trialRate: trialRate.toFixed(1),
    proRate: proRate.toFixed(1),
  };
};

export const resetAnalyticsMetrics = () => {
  Object.keys(metrics).forEach((key) => {
    metrics[key] = 0;
  });
};
