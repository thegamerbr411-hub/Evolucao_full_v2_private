import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NutritionProvider } from './src/context/NutritionContext';
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
import { logError } from './src/utils/errorLogger';
import { shouldInjectQaAppError } from './src/utils/qaTransport';

if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logError(error, {
      screen: 'global',
      extra: { isFatal },
    });
    console.log('GLOBAL ERROR CAPTURADO:', error);
  });
}

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = React.useRef('');

  React.useEffect(() => {
    console.log('[APP_STARTED]', new Date().toISOString());
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

    if (shouldInjectQaAppError()) {
      logError(new Error('BUG_REAL_QA_INJECTED'), {
        screen: 'Home',
        severity: 'medium',
        extra: { source: 'App.useEffect' },
      });
    }
  }, []);

  return (
    <NutritionProvider>
      <RootProvider>
        <SafeAreaProvider>
          <View testID="app-root" style={{ flex: 1 }}>
            <NavigationContainer
              ref={navigationRef}
              onReady={() => {
                routeNameRef.current = navigationRef.getCurrentRoute()?.name || '';
              }}
              onStateChange={() => {
                const currentRoute = navigationRef.getCurrentRoute()?.name || '';
                if (!currentRoute || currentRoute === routeNameRef.current) {
                  return;
                }
                routeNameRef.current = currentRoute;
                trackEvent('screen_view', {
                  screen: currentRoute,
                  meta: {
                    domain: 'navigation',
                    id: `screen-${String(currentRoute).toLowerCase()}`,
                  },
                });
                console.log('[app-nav]', currentRoute);
              }}
            >
              <RootNavigator />
            </NavigationContainer>
          </View>
        </SafeAreaProvider>
      </RootProvider>
    </NutritionProvider>
  );
}
