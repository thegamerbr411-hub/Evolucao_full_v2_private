
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
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
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

export default function RootNavigator(){
  const { hasCompletedQuestionnaire, isHydrated } = useApp();

  if (!isHydrated) {
    return null;
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
      <Stack.Screen name="TreinoLivre" component={FreeWorkoutScreen}/>
      <Stack.Screen name="MacroSemanal" component={WeeklyMacroScreen}/>
      <Stack.Screen name="AutoCoach" component={AutoCoachScreen}/>
      {(__DEV__ ? true : false) ? <Stack.Screen name="DebugMetrics" component={DebugMetricsScreen}/> : null}
      <Stack.Screen name="Paywall" component={PaywallScreen}/>
    </Stack.Navigator>
  );
}
