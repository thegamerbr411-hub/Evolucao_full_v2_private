
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import DebugObservabilityScreen from '../screens/DebugObservabilityScreen';
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

const Stack = createNativeStackNavigator();

export default function RootNavigator(){
  const hasCompletedQuestionnaire = useAppStore((state) => state.hasCompletedQuestionnaire);
  const isHydrated = useUserStore((state) => state.isHydrated);
  const profile = useUserStore((state) => state.profile);
  const user = useUserStore((state) => state.user);
  const hasPersistedProfile = Boolean(profile && Number(profile.currentWeight || 0) > 0);
  const hasAccount = Boolean(user && (user.name || user.id));

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const getInitialRoute = () => {
    if (!hasAccount) return 'Cadastro';
    if (hasCompletedQuestionnaire || hasPersistedProfile) return 'MainTabs';
    return 'Questionario';
  };

  return(
    <Stack.Navigator
      initialRouteName={getInitialRoute()}
      screenOptions={{headerShown:false}}
    >
      <Stack.Screen name="Cadastro" component={RegisterScreen}/>
      <Stack.Screen name="Questionario" component={QuestionnaireScreen}/>
      <Stack.Screen name="MainTabs" component={MainTabs}/>
      <Stack.Screen name="Scanner" component={NutritionScanner}/>
      <Stack.Screen name="AnaliseDia" component={DayAnalysisScreen}/>
      <Stack.Screen name="Insights" component={InsightsScreen}/>
      <Stack.Screen name="Historico" component={HistoryScreen}/>
      <Stack.Screen name="IAWeekly" component={WeeklyInsightScreen}/>
      <Stack.Screen name="TreinoHoje" component={WorkoutScreen}/>
      <Stack.Screen name="Workout" component={WorkoutScreen}/>
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
      {__DEV__ ? <Stack.Screen name="DebugObservability" component={DebugObservabilityScreen}/> : null}
      <Stack.Screen name="Paywall" component={PaywallScreen}/>
    </Stack.Navigator>
  );
}
