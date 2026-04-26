import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import NutritionScanner from '../screens/NutritionScanner';
import WorkoutsHubScreen from '../screens/WorkoutsHubScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import SocialChallengesScreen from '../screens/SocialChallengesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme';
import { trackEvent } from '../utils/analytics';

const Tab = createBottomTabNavigator();

/**
 * 6 ABAS — estrutura principal do app
 *
 * 1. Home    — dashboard, streak, XP, macros do dia
 * 2. Treino  — criar, executar, registrar séries
 * 3. Nutrição — log alimentar, macros, scanner
 * 4. Coach   — chat inteligente, sugestões
 * 5. Social  — amigos, ranking e desafios
 * 6. Perfil  — conta, stats, configurações
 */
export default function MainTabs() {
  const insets = useSafeAreaInsets();

  const createTabButton = (testID, routeName) => {
    return function TabButton(props) {
      const handlePress = () => {
        trackEvent('tap', {
          screen: 'MainTabs',
          meta: {
            allowBurst: true,
            domain: 'navigation',
            id: testID,
            routeName,
          },
        });

        if (typeof props.onPress === 'function') {
          props.onPress();
        }
      };

      return <TouchableOpacity {...props} onPress={handlePress} testID={testID} />;
    };
  };

  const getTabIcon = (routeName, focused) => {
    const iconMap = {
      Home: focused ? 'home' : 'home-outline',
      Treino: focused ? 'barbell' : 'barbell-outline',
      Nutricao: focused ? 'restaurant' : 'restaurant-outline',
      Coach: focused ? 'chatbubbles' : 'chatbubbles-outline',
      Perfil: focused ? 'person-circle' : 'person-circle-outline',
    };
    return iconMap[routeName] || (focused ? 'ellipse' : 'ellipse-outline');
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => <View style={{ flex: 1, backgroundColor: colors.surface }} />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + Math.max(8, insets.bottom),
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarButton: createTabButton('tab-home', 'Home'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Home', focused)} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Treino"
        component={WorkoutsHubScreen}
        options={{
          title: 'Treino',
          tabBarButton: createTabButton('tab-treino', 'Treino'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Treino', focused)} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Nutricao"
        component={NutritionScanner}
        options={{
          title: 'Nutrição',
          tabBarButton: createTabButton('tab-nutricao', 'Nutricao'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Nutricao', focused)} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Coach"
        component={CoachChatScreen}
        options={{
          title: 'Coach',
          tabBarButton: createTabButton('tab-conversa', 'Coach'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Coach', focused)} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Social"
        component={SocialChallengesScreen}
        options={{
          title: 'Social',
          tabBarButton: createTabButton('tab-social', 'Social'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          tabBarButton: createTabButton('tab-perfil', 'Perfil'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Perfil', focused)} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
