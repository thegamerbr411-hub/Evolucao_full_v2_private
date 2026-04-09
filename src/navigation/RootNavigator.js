
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { colors } from '../theme';
import NutritionScanner from '../screens/NutritionScanner';
import QuestionnaireScreen from '../screens/QuestionnaireScreen';
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
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

export default function RootNavigator(){
  const { hasCompletedQuestionnaire, isHydrated } = useApp();

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return(
    <Stack.Navigator
      initialRouteName={hasCompletedQuestionnaire ? 'MainTabs' : 'Questionario'}
      screenOptions={{headerShown:false}}
    >
      <Stack.Screen name="Questionario" component={QuestionnaireScreen}/>
      <Stack.Screen name="MainTabs" component={MainTabs}/>
      <Stack.Screen name="Scanner" component={NutritionScanner}/>
      <Stack.Screen name="AnaliseDia" component={DayAnalysisScreen}/>
      <Stack.Screen name="Insights" component={InsightsScreen}/>
      <Stack.Screen name="Historico" component={HistoryScreen}/>
      <Stack.Screen name="IAWeekly" component={WeeklyInsightScreen}/>
      <Stack.Screen name="TreinoHoje" component={WorkoutScreen}/>
      <Stack.Screen name="Workout" component={WorkoutScreen}/>
      <Stack.Screen name="TreinoLivre" component={FreeWorkoutScreen}/>
      <Stack.Screen name="Rotinas" component={RoutinesScreen}/>
      <Stack.Screen name="ImportWorkout" component={ImportWorkoutScreen}/>
      <Stack.Screen name="Admin" component={AdminScreen}/>
      <Stack.Screen name="MacroSemanal" component={WeeklyMacroScreen}/>
      <Stack.Screen name="AutoCoach" component={AutoCoachScreen}/>
      {(__DEV__ ? true : false) ? <Stack.Screen name="DebugMetrics" component={DebugMetricsScreen}/> : null}
      <Stack.Screen name="Paywall" component={PaywallScreen}/>
    </Stack.Navigator>
  );
}
