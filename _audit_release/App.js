import React from 'react';
import { View, Text } from 'react-native';
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
import { APP_VERSION, BUILD_VERSION } from './src/utils/appVersion';

if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logError(error, {
      screen: 'global',
      extra: { isFatal },
    });
    if (__DEV__) console.log('GLOBAL ERROR CAPTURADO:', error);
  });
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    logError(error, { screen: 'ErrorBoundary', extra: { componentStack: info?.componentStack } });
    console.log('[ErrorBoundary] crash capturado:', error?.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Algo deu errado</Text>
          <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center' }}>Reinicie o aplicativo para continuar.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = React.useRef('');
  const [bootstrapReady, setBootstrapReady] = React.useState(false);

  React.useEffect(() => {
    console.log('[APP_STARTED]', new Date().toISOString());
    console.log('[BUILD_VERSION]', APP_VERSION, BUILD_VERSION);
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
    <ErrorBoundary>
      <NutritionProvider>
        <RootProvider>
          <SafeAreaProvider>
            <View testID="app-root" style={{ flex: 1 }}>
              <NavigationContainer
              ref={navigationRef}
              onReady={() => {
                routeNameRef.current = navigationRef.getCurrentRoute()?.name || '';
                setBootstrapReady(true);
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
            {bootstrapReady ? <View testID="app-bootstrap-ready" style={{ width: 1, height: 1 }} /> : null}
          </View>
        </SafeAreaProvider>
      </RootProvider>
    </NutritionProvider>
    </ErrorBoundary>
  );
}
