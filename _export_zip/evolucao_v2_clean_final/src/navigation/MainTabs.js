import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import WorkoutsHubScreen from '../screens/WorkoutsHubScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import SocialChallengesScreen from '../screens/SocialChallengesScreen';
import SocialScreen from '../screens/SocialScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme';
import { trackEvent } from '../utils/analytics';

const Tab = createBottomTabNavigator();

/**
 * 🔥 ESTRUTURA FINAL DE NAVEGAÇÃO
 * 
 * 6 ABAS (Bottom Tabs):
 * 1. Home (central, resumo do dia, streak, XP)
 * 2. Treino (criação, execução, séries)
 * 3. Coach (sugestões inteligentes)
 * 4. Desafios (daily/weekly, XP rewards)
 * 5. Social (NOVO - feed, ranking, competição)
 * 6. Perfil (stats, plano, config)
 * 
 * REGRA: Cada aba é isolada. Não misturar lógica.
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
      // 1. HOME - central de controle
      Home: focused ? 'home' : 'home-outline',

      // 2. TREINO - core (fazer)
      Treino: focused ? 'barbell' : 'barbell-outline',

      // 3. COACH - inteligência (orientar)
      Coach: focused ? 'chatbubbles' : 'chatbubbles-outline',

      // 4. DESAFIOS - retenção
      Desafios: focused ? 'flame' : 'flame-outline',

      // 5. SOCIAL - vício + competição (NOVO)
      Social: focused ? 'people' : 'people-outline',

      // 6. PERFIL - conta
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
      {/* 1. HOME - Resumo, streak, XP */}
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

      {/* 2. TREINO - Criar, registrar, executar */}
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

      {/* 3. COACH - Sugestões, feedback, inteligência */}
      <Tab.Screen
        name="Coach"
        component={CoachChatScreen}
        options={{
          title: 'Coach',
          tabBarButton: createTabButton('tab-coach', 'Coach'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Coach', focused)} color={color} size={size} />
          ),
        }}
      />

      {/* 4. DESAFIOS - Daily/Weekly, XP, prender usuário */}
      <Tab.Screen
        name="Desafios"
        component={SocialChallengesScreen}
        options={{
          title: 'Desafios',
          tabBarButton: createTabButton('tab-desafios', 'Desafios'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Desafios', focused)} color={color} size={size} />
          ),
        }}
      />

      {/* 5. SOCIAL - Feed, ranking, amigos (NOVO - SEPARADO) */}
      <Tab.Screen
        name="Social"
        component={SocialScreen}
        options={{
          title: 'Social',
          tabBarButton: createTabButton('tab-social', 'Social'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Social', focused)} color={color} size={size} />
          ),
        }}
      />

      {/* 6. PERFIL - Conta, stats, config */}
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
