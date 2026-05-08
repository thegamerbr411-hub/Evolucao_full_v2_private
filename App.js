import React from 'react';
import { Alert, AppState, InteractionManager, LogBox, View, Text } from 'react-native';
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
import {
  initObservability,
  endUserSession,
  logRuntimeError,
  markFeedbackPromptShown,
  startUserSession,
  shouldShowInAppFeedbackPrompt,
  submitInAppFeedback,
  trackScreenClose,
  trackNavigationTransition,
  trackScreenOpen,
  trackScreenRenderDuration,
} from './src/core/observability';
import { captureRuntimeError } from './src/runtime_error_collector';
import { normalizeQaScreenName } from './src/qa/selectorRegistry';
import { registerQaError, setQaAppState, setQaCurrentScreen, setQaLoadingState } from './src/qa/qaAutomationState';

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Detox pode ficar instavel quando o banner de warnings cobre a barra de abas.
  LogBox.ignoreAllLogs(true);
}

if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    captureRuntimeError(error, {
      source: 'global_handler',
      isFatal,
    });
    registerQaError(error, {
      source: 'global_handler',
      isFatal,
    });
    logRuntimeError(error, {
      screen: 'global',
      source: 'global_handler',
      severity: isFatal ? 'critical' : 'high',
      isFatal,
    });
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
    logRuntimeError(error, {
      screen: 'ErrorBoundary',
      source: 'render_crash',
      severity: 'critical',
      componentStack: info?.componentStack,
    });
    logError(error, { screen: 'ErrorBoundary', extra: { componentStack: info?.componentStack } });
    if (__DEV__) {
      captureRuntimeError(error, {
        source: 'error_boundary',
        componentStack: info?.componentStack,
      });
      registerQaError(error, {
        source: 'error_boundary',
      });
      console.log('[ErrorBoundary] crash capturado:', error?.message);
    }
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
  const transitionStartedAtRef = React.useRef(Date.now());
  const feedbackPromptVisibleRef = React.useRef(false);
  const [bootstrapReady, setBootstrapReady] = React.useState(false);

  React.useEffect(() => {
    initObservability();
    startUserSession('app_mount');
    setQaLoadingState(true, 'app_bootstrap');

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      setQaAppState(nextState);
      if (nextState === 'active') {
        startUserSession('app_foreground');
        return;
      }

      if (nextState === 'inactive' || nextState === 'background') {
        endUserSession(nextState === 'inactive' ? 'app_inactive' : 'app_background');
      }
    });

    if (__DEV__) {
      console.log('[APP_STARTED]', new Date().toISOString());
      console.log('[BUILD_VERSION]', APP_VERSION, BUILD_VERSION);
    }
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

    return () => {
      appStateSub?.remove?.();
      endUserSession('app_unmount');
    };
  }, []);

  return (
    <ErrorBoundary>
      <NutritionProvider>
        <RootProvider>
          <SafeAreaProvider>
            <View testID="app-root" accessibilityLabel="app_root" nativeID="app_root" style={{ flex: 1 }}>
              <NavigationContainer
              ref={navigationRef}
              onReady={() => {
                const currentRoute = navigationRef.getCurrentRoute()?.name || '';
                routeNameRef.current = currentRoute;
                transitionStartedAtRef.current = Date.now();
                if (currentRoute) {
                  setQaCurrentScreen(normalizeQaScreenName(currentRoute), currentRoute);
                  setQaLoadingState(false, 'navigation_ready');
                  setAnalyticsContext({ screen: currentRoute });
                  trackScreenOpen(currentRoute, { source: 'navigation_ready' });
                  const startedAt = Date.now();
                  InteractionManager.runAfterInteractions(() => {
                    trackScreenRenderDuration(currentRoute, Date.now() - startedAt, {
                      source: 'navigation_ready',
                    });
                  });
                }
                setBootstrapReady(true);
              }}
              onStateChange={() => {
                const currentRoute = navigationRef.getCurrentRoute()?.name || '';
                if (!currentRoute || currentRoute === routeNameRef.current) {
                  return;
                }

                const previousRoute = routeNameRef.current;
                const closeSummary = previousRoute
                  ? trackScreenClose(previousRoute, {
                      nextScreen: currentRoute,
                      source: 'navigation_change',
                    })
                  : null;

                if (previousRoute) {
                  trackNavigationTransition(previousRoute, currentRoute, {
                    source: 'navigation_change',
                    previousDurationMs: Number(closeSummary?.durationMs || 0),
                    previousActions: Number(closeSummary?.actions || 0),
                  });
                }

                routeNameRef.current = currentRoute;
                transitionStartedAtRef.current = Date.now();
                setQaCurrentScreen(normalizeQaScreenName(currentRoute), currentRoute);
                setAnalyticsContext({ screen: currentRoute });
                trackScreenOpen(currentRoute, {
                  previousScreen: previousRoute || null,
                  source: 'navigation_change',
                });
                trackEvent('screen_view', {
                  screen: currentRoute,
                  meta: {
                    domain: 'navigation',
                    id: `screen-${String(currentRoute).toLowerCase()}`,
                  },
                });
                const startedAt = Date.now();
                InteractionManager.runAfterInteractions(() => {
                  trackScreenRenderDuration(currentRoute, Date.now() - startedAt, {
                    source: 'navigation_change',
                  });
                });

                const shouldAskFeedback =
                  Boolean(closeSummary?.screen) &&
                  Number(closeSummary?.durationMs || 0) >= 10000 &&
                  !feedbackPromptVisibleRef.current &&
                  shouldShowInAppFeedbackPrompt();

                if (shouldAskFeedback) {
                  const question = 'Foi facil usar essa tela?';
                  feedbackPromptVisibleRef.current = true;
                  markFeedbackPromptShown();

                  Alert.alert(
                    'Feedback rapido',
                    question,
                    [
                      {
                        text: '👎',
                        onPress: () => {
                          submitInAppFeedback('down', `${question} [${closeSummary.screen}]`);
                          feedbackPromptVisibleRef.current = false;
                        },
                      },
                      {
                        text: '👍',
                        onPress: () => {
                          submitInAppFeedback('up', `${question} [${closeSummary.screen}]`);
                          feedbackPromptVisibleRef.current = false;
                        },
                      },
                    ],
                    {
                      cancelable: true,
                      onDismiss: () => {
                        feedbackPromptVisibleRef.current = false;
                      },
                    }
                  );
                }

                if (__DEV__) {
                  console.log('[app-nav]', currentRoute);
                }
              }}
            >
              <RootNavigator />
            </NavigationContainer>
            {bootstrapReady ? <View testID="app-bootstrap-ready" accessibilityLabel="app_bootstrap_ready" nativeID="app_bootstrap_ready" style={{ width: 1, height: 1 }} /> : null}
          </View>
        </SafeAreaProvider>
      </RootProvider>
    </NutritionProvider>
    </ErrorBoundary>
  );
}
