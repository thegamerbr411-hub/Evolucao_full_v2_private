
import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { auth } from '../services/firebase';
import { useAppStore } from '../stores/useAppStore';
import { useUserStore } from '../stores/useUserStore';
import { colors } from '../theme';
import NutritionScanner from '../screens/NutritionScanner';
import QuestionnaireScreen from '../screens/QuestionnaireScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DayAnalysisScreen from '../screens/DayAnalysisScreen';
import HistoryScreen from '../screens/HistoryScreen';
import WeeklyInsightScreen from '../screens/WeeklyInsightScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import FreeWorkoutScreen from '../screens/FreeWorkoutScreen';
import WeeklyMacroScreen from '../screens/WeeklyMacroScreen';
import AutoCoachScreen from '../screens/AutoCoachScreen';
import DebugMetricsScreen from '../screens/DebugMetricsScreen';
import PaywallScreen from '../screens/PaywallScreen';
import InsightsScreen from '../screens/InsightsScreen';
import RoutinesScreen from '../screens/RoutinesScreen';
import ImportWorkoutScreen from '../screens/ImportWorkoutScreen';
import AdminScreen from '../screens/AdminScreen';
import SocialChallengesScreen from '../screens/SocialChallengesScreen';
import RankingEvolutionScreen from '../screens/RankingEvolutionScreen';
import ExerciseDetailScreen from '../screens/ExerciseDetailScreen';
import WorkoutCompleteScreen from '../screens/WorkoutCompleteScreen';
import MainTabs from './MainTabs';
import ProfileScreen from '../screens/ProfileScreen';
import { QA_SCREENS } from '../qa/selectorRegistry';
import {
  QA_RUNTIME_STATES,
  endQaMetric,
  setQaAuthState,
  setQaLoadedStores,
  setQaLoadingState,
  setQaReadinessFlags,
  setQaRuntimeState,
  startQaMetric,
} from '../qa/qaAutomationState';
import { seedQaWorkoutReadyState, isQaWorkoutFixtureEnabled, QA_USER_ID_PREFIX } from '../qa/qaWorkoutFixture';

const Stack = createNativeStackNavigator();

/** Web-only QA: jump past auth gate for UX audits. Never enable in production builds you ship. */
const WEB_NAV_AUDIT =
  Platform.OS === 'web' &&
  String(process.env.EXPO_PUBLIC_WEB_NAV_AUDIT || '').trim() === '1';

/**
 * Android/iOS QA: same bypass as web when building a local audit APK (EAS/Gradle + env).
 * Reads from env var (EXPO_PUBLIC_ANDROID_NAV_AUDIT=1) OR from app.json extra.androidNavAudit.
 */
const ANDROID_NAV_AUDIT = (() => {
  if (Platform.OS === 'web') return false;
  const fromEnv = String(process.env.EXPO_PUBLIC_ANDROID_NAV_AUDIT || '').trim() === '1';
  const fromExtra = String(Constants.expoConfig?.extra?.androidNavAudit || '').trim().toLowerCase();
  const fromExtraBool = fromExtra === '1' || fromExtra === 'true' || Constants.expoConfig?.extra?.androidNavAudit === true;
  return fromEnv || fromExtraBool;
})();

const NAV_AUDIT = WEB_NAV_AUDIT || ANDROID_NAV_AUDIT;

export default function RootNavigator(){
  const hasCompletedQuestionnaire = useAppStore((state) => state.hasCompletedQuestionnaire);
  const setHasCompletedQuestionnaire = useAppStore((state) => state.setHasCompletedQuestionnaire);
  const isHydrated = useUserStore((state) => state.isHydrated);
  const profile = useUserStore((state) => state.profile);
  const user = useUserStore((state) => state.user);
  const firebaseUser = auth?.currentUser;
  const hasPersistedProfile = Boolean(profile && Number(profile.currentWeight || 0) > 0);
  const hasAccount = Boolean(user && (user.name || user.id)) || Boolean(firebaseUser?.uid);

  const [navAuditReady, setNavAuditReady] = React.useState(!NAV_AUDIT);

  React.useLayoutEffect(() => {
    if (!NAV_AUDIT || !isHydrated) {
      return;
    }
    const u = useUserStore.getState();
    if (!u.user || !u.user.id) {
      u.setUser({
        id: 'qa-nav-audit',
        role: 'user',
        name: 'QA Nav Audit',
        email: 'qa+navaudit@audit.local',
      });
      u.setProfile({
        goal: 'manter forma',
        level: 'iniciante',
        currentWeight: 80,
        targetWeight: 78,
        height: 175,
        trainingDaysPerWeek: 4,
      });
      setHasCompletedQuestionnaire(true);
    }
    setNavAuditReady(true);
  }, [isHydrated, setHasCompletedQuestionnaire]);

  // QA Workout Fixture: Seed pre-onboarded workout state when enabled
  React.useEffect(() => {
    if (!isQaWorkoutFixtureEnabled() || !isHydrated) {
      return;
    }
    console.log('[QA WORKOUT FIXTURE] nav audit bypass active — seeding QA user and workout state');
    // Always set QA fixture user (overrides any existing user, including anonymous Firebase users)
    const u = useUserStore.getState();
    u.setUser({
      id: `${QA_USER_ID_PREFIX}workout-fixture`,
      role: 'user',
      name: 'QA Workout Fixture',
      email: 'qa+workoutfixture@fixture.local',
    });
    u.setProfile({
      goal: 'hipertrofia',
      level: 'intermediario',
      currentWeight: 80,
      targetWeight: 78,
      height: 175,
      trainingDaysPerWeek: 3,
    });
    setHasCompletedQuestionnaire(true);
    seedQaWorkoutReadyState();
    console.log('[QA WORKOUT FIXTURE] navigation unlocked — hasCompletedQuestionnaire=true, QA user set');
  }, [isHydrated, setHasCompletedQuestionnaire]);

  React.useEffect(() => {
    if (!isHydrated) {
      setQaRuntimeState(QA_RUNTIME_STATES.RESTORING_AUTH, 'root_navigator_waiting_hydration');
      startQaMetric('authRestoreDurationMs', { source: 'root_navigator' });
      startQaMetric('hydrationDurationMs', { source: 'root_navigator' });
    }

    setQaAuthState({
      hydrated: isHydrated,
      hasAccount,
      userId: user?.id || null,
    });

    const loadedStores = [
      'user.store.v1',
      'app.store',
      hasPersistedProfile ? 'profile.persisted' : null,
    ].filter(Boolean);

    setQaLoadedStores(loadedStores);
    setQaLoadingState(!isHydrated, !isHydrated ? 'user_store_hydration' : null);
    setQaReadinessFlags({
      authResolved: Boolean(isHydrated),
      storesHydrated: Boolean(isHydrated && loadedStores.length > 0),
    });

    if (isHydrated) {
      endQaMetric('authRestoreDurationMs', { source: 'root_navigator' });
      endQaMetric('hydrationDurationMs', { source: 'root_navigator' });
      setQaRuntimeState(QA_RUNTIME_STATES.HYDRATING_STORES, 'root_navigator_hydrated');
    }
  }, [hasAccount, hasPersistedProfile, isHydrated, user?.id]);

  if (!isHydrated || (NAV_AUDIT && !navAuditReady)) {
    return (
      <View testID={QA_SCREENS.loading} accessibilityLabel={QA_SCREENS.loading} nativeID={QA_SCREENS.loading} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getInitialRoute = () => {
    if (NAV_AUDIT) {
      return 'MainTabs';
    }
    if (!hasAccount) return 'Cadastro';
    return 'MainTabs';
  };

  return(
    <Stack.Navigator
      key={`${hasAccount ? 'auth' : 'guest'}-${hasCompletedQuestionnaire || hasPersistedProfile ? 'ready' : 'onboarding'}`}
      initialRouteName={getInitialRoute()}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="Cadastro" component={RegisterScreen}/>
      <Stack.Screen name="Questionario" component={QuestionnaireScreen}/>
      <Stack.Screen name="MainTabs" component={MainTabs}/>
      <Stack.Screen name="PerfilConta" component={ProfileScreen}/>
      <Stack.Screen name="Scanner" component={NutritionScanner}/>
      <Stack.Screen name="AnaliseDia" component={DayAnalysisScreen}/>
      <Stack.Screen name="Insights" component={InsightsScreen}/>
      <Stack.Screen name="Historico" component={HistoryScreen}/>
      <Stack.Screen name="IAWeekly" component={WeeklyInsightScreen}/>
      <Stack.Screen name="TreinoHoje" component={WorkoutScreen}/>
      <Stack.Screen name="WorkoutCompleteScreen" component={WorkoutCompleteScreen}/>
      <Stack.Screen name="TreinoLivre" component={FreeWorkoutScreen}/>
      <Stack.Screen name="Rotinas" component={RoutinesScreen}/>
      <Stack.Screen name="ImportWorkout" component={ImportWorkoutScreen}/>
      <Stack.Screen name="Admin" component={AdminScreen}/>
      <Stack.Screen name="SocialChallenges" component={SocialChallengesScreen}/>
      <Stack.Screen name="RankingEvolution" component={RankingEvolutionScreen}/>
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen}/>
      <Stack.Screen name="MacroSemanal" component={WeeklyMacroScreen}/>
      <Stack.Screen name="AutoCoach" component={AutoCoachScreen}/>
      {__DEV__ ? <Stack.Screen name="DebugMetrics" component={DebugMetricsScreen}/> : null}
      <Stack.Screen name="Paywall" component={PaywallScreen}/>
    </Stack.Navigator>
  );
}
