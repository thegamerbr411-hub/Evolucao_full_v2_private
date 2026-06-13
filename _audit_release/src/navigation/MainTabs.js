import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform, TouchableOpacity, View } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import NutritionScanner from '../screens/NutritionScanner';
import WorkoutsHubScreen from '../screens/WorkoutsHubScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import SocialChallengesScreen from '../screens/SocialChallengesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme';
import { trackEvent } from '../utils/analytics';
import { QA_ELEMENTS } from '../qa/selectorRegistry';

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

  const createTabButton = (testID, routeName, qaId) => {
    return function TabButton(props) {
      const handlePress = () => {
        try {
          trackEvent('tap', {
            screen: 'MainTabs',
            meta: {
              allowBurst: true,
              domain: 'navigation',
              id: testID,
              routeName,
            },
          });
        } catch {
          // Analytics nao pode bloquear a navegacao entre abas.
        }

        if (typeof props.onPress === 'function') {
          props.onPress();
        }
      };

      return (
        <TouchableOpacity
          {...props}
          onPress={handlePress}
          testID={testID}
          accessibilityLabel={qaId}
          nativeID={qaId}
          accessibilityHint={`legacy:${testID}`}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
      );
    };
  };

  const getTabIcon = (routeName, focused) => {
    const iconMap = {
      Home: focused ? 'home' : 'home-outline',
      Treino: focused ? 'barbell' : 'barbell-outline',
      Nutricao: focused ? 'restaurant' : 'restaurant-outline',
      Coach: focused ? 'chatbubbles' : 'chatbubbles-outline',
      Social: focused ? 'people' : 'people-outline',
      Perfil: focused ? 'person-circle' : 'person-circle-outline',
    };
    return iconMap[routeName] || (focused ? 'ellipse' : 'ellipse-outline');
  };

  return (
    <Tab.Navigator
      initialRouteName="Home"
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
          minHeight: 56,
          height: 56 + Math.max(10, insets.bottom + (Platform.OS === 'android' ? 4 : 0)),
          paddingBottom: Math.max(10, insets.bottom + (Platform.OS === 'android' ? 4 : 0)),
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
          tabBarButton: createTabButton('tab-home', 'Home', QA_ELEMENTS.tabHome),
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
          tabBarButton: createTabButton('tab-treino', 'Treino', QA_ELEMENTS.tabTreinos),
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
          tabBarButton: createTabButton('tab-nutricao', 'Nutricao', QA_ELEMENTS.tabNutricao),
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
          tabBarButton: createTabButton('tab-conversa', 'Coach', QA_ELEMENTS.tabCoach),
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
          tabBarButton: createTabButton('tab-social', 'Social', QA_ELEMENTS.tabSocial),
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
          tabBarButton: createTabButton('tab-perfil', 'Perfil', QA_ELEMENTS.tabProfile),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Perfil', focused)} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
