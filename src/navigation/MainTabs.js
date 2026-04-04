import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import NutritionScanner from '../screens/NutritionScanner';
import WorkoutsHubScreen from '../screens/WorkoutsHubScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import RoutinesScreen from '../screens/RoutinesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const insets = useSafeAreaInsets();

  const getTabIcon = (routeName, focused) => {
    const iconMap = {
      HomeHoje: focused ? 'home' : 'home-outline',
      Nutricao: focused ? 'restaurant' : 'restaurant-outline',
      Treinos: focused ? 'barbell' : 'barbell-outline',
      Conversa: focused ? 'chatbubbles' : 'chatbubbles-outline',
      Rotinas: focused ? 'grid' : 'grid-outline',
      Perfil: focused ? 'person-circle' : 'person-circle-outline',
    };

    return iconMap[routeName] || (focused ? 'ellipse' : 'ellipse-outline');
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 56 + Math.max(10, insets.bottom + 6),
          paddingBottom: Math.max(10, insets.bottom),
          paddingTop: 8,
        },
      }}
    >
      <Tab.Screen name="HomeHoje" component={HomeScreen} options={{ title: 'Home', tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('HomeHoje', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Nutricao" component={NutritionScanner} options={{ title: 'Nutricao', tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Nutricao', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Treinos" component={WorkoutsHubScreen} options={{ title: 'Treinos', tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Treinos', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Conversa" component={CoachChatScreen} options={{ title: 'Conversa', tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Conversa', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Rotinas" component={RoutinesScreen} options={{ title: 'Rotinas', tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Rotinas', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} options={{ title: 'Perfil', tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Perfil', focused)} color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
