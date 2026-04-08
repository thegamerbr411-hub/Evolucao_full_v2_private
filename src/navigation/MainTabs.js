import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import NutritionScanner from '../screens/NutritionScanner';
import WorkoutsHubScreen from '../screens/WorkoutsHubScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const insets = useSafeAreaInsets();

  const createTabButton = (testID) => {
    return function TabButton(props) {
      return <TouchableOpacity {...props} testID={testID} />;
    };
  };

  const getTabIcon = (routeName, focused) => {
    const iconMap = {
      HomeHoje: focused ? 'home' : 'home-outline',
      Nutricao: focused ? 'restaurant' : 'restaurant-outline',
      Treinos: focused ? 'barbell' : 'barbell-outline',
      Conversa: focused ? 'chatbubbles' : 'chatbubbles-outline',
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
      <Tab.Screen name="HomeHoje" component={HomeScreen} options={{ title: 'Home', tabBarButton: createTabButton('tab-home'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('HomeHoje', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Nutricao" component={NutritionScanner} options={{ title: 'Nutricao', tabBarButton: createTabButton('tab-nutricao'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Nutricao', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Treinos" component={WorkoutsHubScreen} options={{ title: 'Treino', tabBarButton: createTabButton('tab-treino'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Treinos', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Conversa" component={CoachChatScreen} options={{ title: 'Coach', tabBarButton: createTabButton('tab-conversa'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Conversa', focused)} color={color} size={size} /> }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} options={{ title: 'Perfil', tabBarButton: createTabButton('tab-perfil'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={getTabIcon('Perfil', focused)} color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
