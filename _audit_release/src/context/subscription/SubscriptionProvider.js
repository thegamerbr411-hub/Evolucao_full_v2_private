import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_MONETIZATION,
  getSubscriptionStatusFor,
  hasFeatureAccessFor,
  normalizeMonetization,
  withActivatedProPlan,
  withStartedProTrial,
} from './subscriptionService';
import api from '../../services/api';

const SubscriptionContext = createContext(null);
const SUBSCRIPTION_STORAGE_KEY = 'evolucao.subscription.v1';
const LEGACY_STORAGE_KEY = 'evolucao.profile_plan.v1';

export function SubscriptionProvider({ children }) {
  const [monetization, setMonetization] = useState(DEFAULT_MONETIZATION);

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const rawSubscription = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
        if (rawSubscription) {
          setMonetization(normalizeMonetization(JSON.parse(rawSubscription)));
          return;
        }

        const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        if (!legacyRaw) {
          return;
        }

        const legacyParsed = JSON.parse(legacyRaw);
        const migrated = normalizeMonetization(legacyParsed?.monetization);
        setMonetization(migrated);
        await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(migrated));
      } catch (error) {
        // Ignore invalid local payloads and keep default state.
      }
    };

    loadSubscription();
  }, []);

  useEffect(() => {
    const persist = async () => {
      try {
        await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(monetization));
      } catch (error) {
        // Keep runtime resilient when storage fails.
      }
    };

    persist();
  }, [monetization]);

  const getSubscriptionStatus = useCallback(() => getSubscriptionStatusFor(monetization), [monetization]);

  const hasFeatureAccess = useCallback(
    (featureKey) => hasFeatureAccessFor(monetization, featureKey),
    [monetization]
  );

  const startProTrial = useCallback(async () => {
    try {
      const response = await api.post('/api/subscription/activate', { type: 'trial' });
      if (!response?.data?.ok) {
        console.warn('[SUBSCRIPTION] Backend recusou ativacao de trial.');
        return { ok: false };
      }
    } catch (error) {
      console.warn('[SUBSCRIPTION] Backend indisponivel para trial — bloqueado.', error?.message);
      return { ok: false };
    }
    setMonetization((prev) => withStartedProTrial(prev));
    return { ok: true };
  }, []);

  const activateProPlan = useCallback(async () => {
    try {
      const response = await api.post('/api/subscription/activate', { type: 'pro' });
      if (!response?.data?.ok) {
        console.warn('[SUBSCRIPTION] Backend recusou ativacao PRO.');
        return { ok: false };
      }
    } catch (error) {
      console.warn('[SUBSCRIPTION] Backend indisponivel para PRO — bloqueado.', error?.message);
      return { ok: false };
    }
    setMonetization((prev) => withActivatedProPlan(prev));
    return { ok: true };
  }, []);

  const resetSubscription = useCallback(() => {
    setMonetization(DEFAULT_MONETIZATION);
  }, []);

  const value = useMemo(
    () => ({
      monetization,
      getSubscriptionStatus,
      hasFeatureAccess,
      startProTrial,
      activateProPlan,
      resetSubscription,
    }),
    [
      monetization,
      getSubscriptionStatus,
      hasFeatureAccess,
      startProTrial,
      activateProPlan,
      resetSubscription,
    ]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptionDomain() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptionDomain must be used within SubscriptionProvider');
  }

  return context;
}
