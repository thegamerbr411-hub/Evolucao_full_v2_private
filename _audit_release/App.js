import * as Sentry from '@sentry/react-native';
import React from 'react';
import { Alert, AppState, InteractionManager, Linking, LogBox, Platform, View, Text } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const sentryNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

const SENTRY_DSN = String(process.env.EXPO_PUBLIC_SENTRY_DSN || '').trim();

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 1.0 : 0.15,
    enableLogs: true,
    integrations: [sentryNavigationIntegration],
    enableNativeFramesTracking: true,
    environment: __DEV__ ? 'development' : 'production',
    debug: __DEV__,
    tracePropagationTargets: [
      /^https:\/\/evolucao-api-/, /^https:\/\/.*\.onrender\.com/,
    ],
  });
}
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
import { normalizeQaScreenName, QA_ELEMENTS } from './src/qa/selectorRegistry';
import { logQaVisualSessionBoot } from './src/qa/visualSessionBoot';
import { clearWorkoutQaStateForRuntimeAudit } from './src/qa/workoutQaReset';
import {
  QA_RUNTIME_STATES,
  endQaMetric,
  getQaHealthSnapshot,
  registerQaError,
  registerQaFpsSample,
  registerQaMemorySnapshot,
  setQaAppState,
  setQaAsyncState,
  setQaCurrentScreen,
  setQaLoadingState,
  setQaReadinessFlags,
  setQaRuntimeState,
  setQaStall,
  startQaMetric,
  subscribeQaHealth,
} from './src/qa/qaAutomationState';
import {
  installGlobalNetworkTracking,
  subscribeNetworkSnapshot,
} from './src/runtime_sync/networkActivityManager';
import {
  endAsyncTask,
  getAsyncTaskSnapshot,
  registerTimer,
  setListenerCount,
  startAsyncTask,
  subscribeAsyncTaskSnapshot,
  unregisterTimer,
} from './src/runtime_sync/asyncTaskRegistry';
import { getRuntimeBusyReasons } from './src/runtime_sync/runtimeIdleEngine';
import { analyzeRuntimeResidue } from './src/runtime_sync/runtimeResidueAnalyzer';
import {
  captureForensicsSnapshot,
  estimateHeapSnapshotMb,
  recordListenerEvent,
  recordTimerEvent,
} from './src/runtime_sync/runtimeForensicsCollector';

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // Detox pode ficar instavel quando o banner de warnings cobre a barra de abas.
  LogBox.ignoreAllLogs(true);
}

if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try { Sentry.captureException(error, { tags: { source: 'global_handler', isFatal: String(isFatal) } }); } catch {}
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
    try {
      Sentry.captureException(error, {
        tags: { source: 'error_boundary' },
        contexts: { react: { componentStack: info?.componentStack || '' } },
      });
    } catch {}
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
      const errorMessage = String(this.state.error?.message || '').trim();
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Algo deu errado</Text>
          <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center' }}>Reinicie o aplicativo para continuar.</Text>
          {errorMessage ? (
            <Text style={{ color: '#fca5a5', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

const RUNTIME_STALL_THRESHOLDS_MS = Object.freeze({
  BOOT_STALL: 20000,
  NAVIGATION_STALL: 10000,
  PLAYER_STALL: 15000,
});

function runtimeStateToElementId(runtimeState) {
  const normalized = String(runtimeState || '').toLowerCase();
  return `app_runtime_state_${normalized}`;
}

function HiddenAnchor({ id }) {
  if (!id) {
    return null;
  }

  return (
    <View
      testID={id}
      accessibilityLabel={id}
      nativeID={id}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 8,
        height: 8,
        opacity: 0.01,
      }}
    />
  );
}

/**
 * Web: sem `linking`, o browser pode mostrar `/MainTabs/Treino` mas o estado inicial
 * fica no primeiro tab (Home). Isto alinha URL ↔ navigator para deep links e refresh.
 *
 * Native (Android/iOS): o mesmo mapa com prefixo `evolucao://` (app.json scheme + manifest)
 * permite QA/abrir tabs reais sem depender só do Web.
 */
const NAVIGATION_LINKING_SCREENS = {
  Cadastro: 'Cadastro',
  Questionario: 'Questionario',
  MainTabs: {
    path: 'MainTabs',
    screens: {
      Home: 'Home',
      Treino: 'Treino',
      Nutricao: 'Nutricao',
      Coach: 'Coach',
      Social: 'Social',
      Perfil: 'Perfil',
    },
  },
  Scanner: 'Scanner',
  AnaliseDia: 'AnaliseDia',
  Insights: 'Insights',
  Historico: 'Historico',
  IAWeekly: 'IAWeekly',
  TreinoHoje: 'TreinoHoje',
  Workout: 'Workout',
  WorkoutCompleteScreen: 'WorkoutCompleteScreen',
  TreinoLivre: 'TreinoLivre',
  Rotinas: 'Rotinas',
  ImportWorkout: 'ImportWorkout',
  Admin: 'Admin',
  SocialChallenges: 'SocialChallenges',
  RankingEvolution: 'RankingEvolution',
  ExerciseDetail: 'ExerciseDetail',
  MacroSemanal: 'MacroSemanal',
  AutoCoach: 'AutoCoach',
  Paywall: 'Paywall',
  ...(__DEV__ ? { DebugMetrics: 'DebugMetrics' } : {}),
};

const NAVIGATION_LINKING =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
    ? {
        prefixes: [window.location.origin],
        config: { screens: NAVIGATION_LINKING_SCREENS },
      }
    : Platform.OS !== 'web'
      ? {
          prefixes: ['evolucao://', 'com.tipolt.evolucaofullv2://'],
          config: { screens: NAVIGATION_LINKING_SCREENS },
        }
      : undefined;

function App() {
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = React.useRef('');
  const transitionStartedAtRef = React.useRef(Date.now());
  const feedbackPromptVisibleRef = React.useRef(false);
  const [bootstrapReady, setBootstrapReady] = React.useState(false);
  const [qaHealthSnapshot, setQaHealthSnapshot] = React.useState(() => getQaHealthSnapshot());

  React.useEffect(() => {
    if (!__DEV__) {
      return undefined;
    }

    global.__EVOLUCAO_QA_CLEAR_WORKOUT__ = clearWorkoutQaStateForRuntimeAudit;
    const handleUrl = ({ url }) => {
      try {
        if (typeof url === 'string' && url.startsWith('evolucao://qa/workout-reset')) {
          clearWorkoutQaStateForRuntimeAudit().catch((error) => {
            console.log('[WORKOUT][QA_RESET_ERROR]', error?.message || 'unknown');
          });
        }
      } catch (error) {
        console.log('[WORKOUT][QA_RESET_ERROR]', error?.message || 'unknown');
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    return () => {
      delete global.__EVOLUCAO_QA_CLEAR_WORKOUT__;
      sub.remove();
    };
  }, []);

  React.useEffect(() => {
    if (__DEV__) {
      logQaVisualSessionBoot();
    }
    initObservability();
    startUserSession('app_mount');

    const uninstallNetworkTracking = installGlobalNetworkTracking();
    const unsubscribeNetwork = subscribeNetworkSnapshot(() => {
      setQaHealthSnapshot(getQaHealthSnapshot());
    });
    const unsubscribeAsync = subscribeAsyncTaskSnapshot(() => {
      setQaHealthSnapshot(getQaHealthSnapshot());
    });

    setQaRuntimeState(QA_RUNTIME_STATES.BOOTING, 'app_mount');
    startQaMetric('bootDurationMs', { source: 'app_mount' });
    startQaMetric('authRestoreDurationMs', { source: 'app_mount' });
    startQaMetric('hydrationDurationMs', { source: 'app_mount' });
    setQaLoadingState(true, 'app_bootstrap');
    setQaReadinessFlags({
      appInitialized: false,
      navigationReady: false,
      authResolved: false,
      storesHydrated: false,
      splashFinished: false,
      runtimeSynchronized: false,
    });

    const bootStallTimer = setTimeout(() => {
      setQaStall('boot', true, RUNTIME_STALL_THRESHOLDS_MS.BOOT_STALL, {
        thresholdMs: RUNTIME_STALL_THRESHOLDS_MS.BOOT_STALL,
      });
    }, RUNTIME_STALL_THRESHOLDS_MS.BOOT_STALL);
    registerTimer('boot_stall_timer', bootStallTimer, 'timeout');
    recordTimerEvent('boot_stall_timer', 'created', { kind: 'timeout' });

    setQaRuntimeState(QA_RUNTIME_STATES.INITIALIZING, 'app_init_pipeline');

    const unsubscribeQa = subscribeQaHealth((nextState) => {
      setQaHealthSnapshot(nextState);
    });
    recordListenerEvent('qa_health', 'created', { scope: 'app_mount' });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      setQaAppState(nextState);
      recordListenerEvent('app_state', 'event', { nextState });
      if (nextState === 'active') {
        startUserSession('app_foreground');
        setQaRuntimeState(QA_RUNTIME_STATES.RESTORING_FROM_BACKGROUND, 'app_active');
        captureForensicsSnapshot('app_foreground', {
          appState: nextState,
          qaRuntime: getQaHealthSnapshot()?.runtime?.state || 'unknown',
        });
        return;
      }

      if (nextState === 'inactive' || nextState === 'background') {
        endUserSession(nextState === 'inactive' ? 'app_inactive' : 'app_background');
        captureForensicsSnapshot('app_background', {
          appState: nextState,
          qaRuntime: getQaHealthSnapshot()?.runtime?.state || 'unknown',
        });
      }
    });
    recordListenerEvent('app_state', 'created', { scope: 'app_mount' });
    setListenerCount(1);

    const fpsProbeTimer = setInterval(() => {
      const interactionMs = Date.now() - Number(transitionStartedAtRef.current || Date.now());
      const approxFps = Math.max(12, Math.min(60, Math.round(60000 / Math.max(800, interactionMs))));
      registerQaFpsSample(approxFps);
    }, 8000);
    registerTimer('fps_probe_timer', fpsProbeTimer, 'interval');
    recordTimerEvent('fps_probe_timer', 'created', { kind: 'interval' });

    const forensicsProbeTimer = setInterval(() => {
      const healthSnapshot = getQaHealthSnapshot();
      const residue = analyzeRuntimeResidue(healthSnapshot, { source: 'forensics_probe_timer' });
      const heapMb = estimateHeapSnapshotMb();

      if (heapMb > 0) {
        registerQaMemorySnapshot(heapMb, 'forensics_probe_timer');
      }

      const asyncSnapshot = getAsyncTaskSnapshot();
      const forensicSnapshot = captureForensicsSnapshot('periodic_forensics_probe', {
        heapMb,
        runtimeState: healthSnapshot?.runtime?.state || 'unknown',
        busyReasons: healthSnapshot?.runtime?.idle?.busyReasons || [],
        async: {
          pendingAsyncTasks: Number(asyncSnapshot?.pendingAsyncTasks || 0),
          activeTimers: Number(asyncSnapshot?.activeTimers || 0),
          orphanTimers: Number(asyncSnapshot?.orphanTimers || 0),
          longRunningTimers: Number(asyncSnapshot?.longRunningTimers || 0),
          retryLoops: Number(asyncSnapshot?.retryLoops || 0),
          listenerCount: Number(asyncSnapshot?.listenerCount || 0),
        },
        residue,
      });

      if (__DEV__) {
        console.log(`[FORENSICS] snapshot=${JSON.stringify(forensicSnapshot)}`);
        console.log(`[RUNTIME_RESIDUE] ${JSON.stringify(residue)}`);
      }
    }, 12000);
    registerTimer('forensics_probe_timer', forensicsProbeTimer, 'interval');
    recordTimerEvent('forensics_probe_timer', 'created', { kind: 'interval' });

    if (__DEV__) {
      console.log('[APP_STARTED]', new Date().toISOString());
      console.log('[BUILD_VERSION]', APP_VERSION, BUILD_VERSION);
    }

    const analyticsTaskId = startAsyncTask('initialize_analytics_session', 'bootstrap');
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
        // Keep analytics resilient on bootstrap failure.
      })
      .finally(() => {
        endAsyncTask(analyticsTaskId);
      });

    const notificationsTaskId = startAsyncTask('initialize_notifications', 'bootstrap');
    initializeNotifications()
      .catch(() => {
        // Keep startup resilient even without permission.
      })
      .finally(() => {
        endAsyncTask(notificationsTaskId);
      });

    if (shouldInjectQaAppError()) {
      logError(new Error('BUG_REAL_QA_INJECTED'), {
        screen: 'Home',
        severity: 'medium',
        extra: { source: 'App.useEffect' },
      });
    }

    return () => {
      clearTimeout(bootStallTimer);
      clearInterval(fpsProbeTimer);
      clearInterval(forensicsProbeTimer);
      unregisterTimer(bootStallTimer);
      unregisterTimer(fpsProbeTimer);
      unregisterTimer(forensicsProbeTimer);
      recordTimerEvent('boot_stall_timer', 'cleared', { kind: 'timeout' });
      recordTimerEvent('fps_probe_timer', 'cleared', { kind: 'interval' });
      recordTimerEvent('forensics_probe_timer', 'cleared', { kind: 'interval' });
      setListenerCount(0);
      unsubscribeNetwork?.();
      unsubscribeAsync?.();
      uninstallNetworkTracking?.();
      unsubscribeQa?.();
      appStateSub?.remove?.();
      recordListenerEvent('app_state', 'removed', { scope: 'app_unmount' });
      recordListenerEvent('qa_health', 'removed', { scope: 'app_unmount' });

      const finalHealthSnapshot = getQaHealthSnapshot();
      const finalResidue = analyzeRuntimeResidue(finalHealthSnapshot, { source: 'app_unmount' });
      const finalForensicsSnapshot = captureForensicsSnapshot('app_unmount', {
        runtimeState: finalHealthSnapshot?.runtime?.state || 'unknown',
        busyReasons: finalHealthSnapshot?.runtime?.idle?.busyReasons || [],
        residue: finalResidue,
      });
      if (__DEV__) {
        console.log(`[FORENSICS] snapshot=${JSON.stringify(finalForensicsSnapshot)}`);
        console.log(`[RUNTIME_RESIDUE] ${JSON.stringify(finalResidue)}`);
      }
      endUserSession('app_unmount');
    };
  }, []);

  React.useEffect(() => {
    const poll = setInterval(() => {
      setQaHealthSnapshot(getQaHealthSnapshot());
    }, 500);

    return () => clearInterval(poll);
  }, []);

  React.useEffect(() => {
    const readiness = qaHealthSnapshot?.runtime?.readiness || {};
    if (readiness.runtimeSynchronized) {
      setQaRuntimeState(QA_RUNTIME_STATES.READY, 'runtime_synchronized');
      setQaStall('boot', false, 0, { resolved: true });
      endQaMetric('bootDurationMs', { source: 'runtime_synchronized' });
    }
  }, [qaHealthSnapshot?.runtime?.readiness?.runtimeSynchronized]);

  const runtimeState = qaHealthSnapshot?.runtime?.state || QA_RUNTIME_STATES.BOOTING;
  const readiness = qaHealthSnapshot?.runtime?.readiness || {};
  const networkIdle = Boolean(qaHealthSnapshot?.network?.idle);
  const asyncIdle = Boolean(qaHealthSnapshot?.async?.runtimeIdle);
  const runtimeIdle = Boolean(qaHealthSnapshot?.runtime?.idle?.runtimeIdle);
  const busyReasons = Array.isArray(qaHealthSnapshot?.runtime?.idle?.busyReasons)
    ? qaHealthSnapshot.runtime.idle.busyReasons
    : getRuntimeBusyReasons();

  React.useEffect(() => {
    const pendingAsyncTasks = Number(qaHealthSnapshot?.async?.pendingAsyncTasks || 0);
    const activeTimers = Number(qaHealthSnapshot?.async?.activeTimers || 0);
    const backgroundTasks = Number(qaHealthSnapshot?.async?.backgroundTasks || 0);

    setQaAsyncState({
      pendingAsyncTasks,
      activeTimers,
      backgroundTasks,
      runtimeIdle: pendingAsyncTasks <= 0 && activeTimers <= 0 && backgroundTasks <= 0,
    });
  }, [qaHealthSnapshot?.async?.pendingAsyncTasks, qaHealthSnapshot?.async?.activeTimers, qaHealthSnapshot?.async?.backgroundTasks]);

  return (
    <ErrorBoundary>
        <RootProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
            <View testID={QA_ELEMENTS.appRoot} accessibilityLabel={QA_ELEMENTS.appRoot} nativeID={QA_ELEMENTS.appRoot} style={{ flex: 1 }}>
              <NavigationContainer
              ref={navigationRef}
              linking={NAVIGATION_LINKING}
              onReady={() => {
                try { sentryNavigationIntegration.registerNavigationContainer(navigationRef); } catch {}
                const currentRoute = navigationRef.getCurrentRoute()?.name || '';
                routeNameRef.current = currentRoute;
                transitionStartedAtRef.current = Date.now();

                endQaMetric('navigationDurationMs', { source: 'navigation_on_ready' });
                setQaRuntimeState(QA_RUNTIME_STATES.NAVIGATION_READY, 'navigation_on_ready');
                setQaReadinessFlags({
                  appInitialized: true,
                  navigationReady: true,
                  splashFinished: true,
                });
                setQaLoadingState(false, 'navigation_ready');

                if (currentRoute) {
                  setQaCurrentScreen(normalizeQaScreenName(currentRoute), currentRoute);
                  setAnalyticsContext({ screen: currentRoute });
                  trackScreenOpen(currentRoute, { source: 'navigation_ready' });
                  const startedAt = Date.now();
                  InteractionManager.runAfterInteractions(() => {
                    trackScreenRenderDuration(currentRoute, Date.now() - startedAt, {
                      source: 'navigation_ready',
                    });
                  });
                }

                setQaStall('navigation', false, 0, { resolved: true });
                setBootstrapReady(true);
              }}
              onStateChange={() => {
                const currentRoute = navigationRef.getCurrentRoute()?.name || '';
                if (!currentRoute || currentRoute === routeNameRef.current) {
                  return;
                }

                const previousRoute = routeNameRef.current;
                startQaMetric('navigationDurationMs', {
                  source: 'navigation_change',
                  from: previousRoute || null,
                  to: currentRoute,
                });
                const navigationStallTimer = setTimeout(() => {
                  setQaStall('navigation', true, RUNTIME_STALL_THRESHOLDS_MS.NAVIGATION_STALL, {
                    from: previousRoute || null,
                    to: currentRoute,
                    thresholdMs: RUNTIME_STALL_THRESHOLDS_MS.NAVIGATION_STALL,
                  });
                }, RUNTIME_STALL_THRESHOLDS_MS.NAVIGATION_STALL);
                registerTimer('navigation_stall_timer', navigationStallTimer, 'timeout');
                recordTimerEvent('navigation_stall_timer', 'created', {
                  kind: 'timeout',
                  from: previousRoute || null,
                  to: currentRoute,
                });

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
                  clearTimeout(navigationStallTimer);
                  unregisterTimer(navigationStallTimer);
                  recordTimerEvent('navigation_stall_timer', 'cleared', {
                    kind: 'timeout',
                    route: currentRoute,
                  });
                  setQaStall('navigation', false, 0, { resolved: true, route: currentRoute });
                  endQaMetric('navigationDurationMs', {
                    source: 'navigation_change',
                    route: currentRoute,
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
            {bootstrapReady ? <HiddenAnchor id={QA_ELEMENTS.appBootstrapReady} /> : null}
            <HiddenAnchor id={runtimeStateToElementId(runtimeState)} />
            {readiness.navigationReady ? <HiddenAnchor id={QA_ELEMENTS.appRuntimeNavigationReady} /> : null}
            {readiness.runtimeSynchronized ? <HiddenAnchor id={QA_ELEMENTS.appRuntimeReady} /> : null}
            {readiness.navigationReady ? <HiddenAnchor id={QA_ELEMENTS.appReadinessNavigationReady} /> : null}
            {readiness.authResolved ? <HiddenAnchor id={QA_ELEMENTS.appReadinessAuthResolved} /> : null}
            {readiness.storesHydrated ? <HiddenAnchor id={QA_ELEMENTS.appReadinessStoresHydrated} /> : null}
            {readiness.splashFinished ? <HiddenAnchor id={QA_ELEMENTS.appReadinessSplashFinished} /> : null}
            {readiness.runtimeSynchronized ? <HiddenAnchor id={QA_ELEMENTS.appReadinessRuntimeSynchronized} /> : null}
            {networkIdle ? <HiddenAnchor id={QA_ELEMENTS.appNetworkIdle} /> : <HiddenAnchor id={QA_ELEMENTS.appNetworkBusy} />}
            {asyncIdle ? <HiddenAnchor id={QA_ELEMENTS.appAsyncIdle} /> : <HiddenAnchor id={QA_ELEMENTS.appAsyncBusy} />}
            {runtimeIdle ? <HiddenAnchor id={QA_ELEMENTS.appRuntimeIdle} /> : <HiddenAnchor id={QA_ELEMENTS.appRuntimeBusy} />}
            {busyReasons.length > 0 ? <HiddenAnchor id={`app_runtime_busy_reason_${String(busyReasons[0]).replace(/[^a-z0-9_]+/gi, '_').toLowerCase()}`} /> : null}
          </View>
            </GestureHandlerRootView>
        </SafeAreaProvider>
      </RootProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);
