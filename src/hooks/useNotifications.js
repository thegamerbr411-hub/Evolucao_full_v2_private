import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useNotifications() {
  const app = useApp();

  return useMemo(
    () => ({
      hasFeatureAccess: app.hasFeatureAccess,
      getSubscriptionStatus: app.getSubscriptionStatus,
      startProTrial: app.startProTrial,
      activateProPlan: app.activateProPlan,
      addWaterIntake: app.addWaterIntake,
    }),
    [app]
  );
}
