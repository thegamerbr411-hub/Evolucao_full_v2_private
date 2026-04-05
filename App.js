
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { RootProvider } from './src/context/RootProvider';
import { initializeNotifications } from './src/utils/notifications';
import {
  getAppOpenSessionMeta,
  initializeAnalyticsSession,
  SCREENS,
  setAnalyticsContext,
  trackEvent,
} from './src/utils/analytics';

export default function App() {
  React.useEffect(() => {
    initializeAnalyticsSession()
      .then(async (sessionId) => {
        const { dayKey, isFirstOpenOfDay } = await getAppOpenSessionMeta();
        setAnalyticsContext({ screen: SCREENS.APP, sessionId });
        trackEvent('app_opened', {
          screen: SCREENS.APP,
          meta: {
            domain: 'engagement',
            version: 1,
            dayKey,
            isFirstOpenOfDay,
          },
        });
      })
      .catch(() => {
        // Mantem analytics resiliente em caso de falha local.
      });

    initializeNotifications().catch(() => {
      // Mantem inicializacao resiliente mesmo sem permissao.
    });
  }, []);

  return (
    <RootProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </RootProvider>
  );
}
