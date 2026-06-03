import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform, TouchableOpacity, View } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import NutritionScanner from '../screens/NutritionScanner';
import WorkoutsHubScreen from '../screens/WorkoutsHubScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import MoreHubScreen from '../screens/MoreHubScreen';
import { colors } from '../theme';
import { trackEvent } from '../utils/analytics';
import { QA_ELEMENTS } from '../qa/selectorRegistry';

const Tab = createBottomTabNavigator();

/**
 * 5 ABAS — estrutura principal (Social + Perfil em "Mais")
 *
 * 1. Home    — dashboard, streak, XP, macros do dia
 * 2. Treino  — criar, executar, registrar séries
 * 3. Nutrição — log alimentar, macros, scanner
 * 4. Coach   — chat inteligente, sugestões
 * 5. Mais    — social, perfil, admin (stack)
 */
export default function MainTabs() {
  const insets = useSafeAreaInsets();

  /**
   * Native: custom TouchableOpacity so Detox/QA get stable testIDs + analytics on tab.
   * Web: MUST use the default tab bar button (PlatformPressable + href/role wiring).
   * A TouchableOpacity wrapper drops web-specific props and breaks tab scene updates
   * (URL/state change while the Home frame stays painted — reproducible in Playwright).
   */
  const createTabButton = (testID, routeName, qaId) => {
    if (Platform.OS === 'web') {
      return undefined;
    }
    return function TabButton(props) {
      const { style: tabButtonStyle, ...tabButtonRest } = props;
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
          {...tabButtonRest}
          style={[tabButtonStyle, { flex: 1 }]}
          onPress={handlePress}
          testID={testID}
          accessibilityLabel={qaId}
          nativeID={qaId}
          accessibilityHint={`legacy:${testID}`}
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
      Mais: focused ? 'menu' : 'menu-outline',
    };
    return iconMap[routeName] || (focused ? 'ellipse' : 'ellipse-outline');
  };

  return (
    <Tab.Navigator
      /**
       * Web (RN Screens): com detachInactiveScreens=true (default da lib no web),
       * cenas inactivas usam Screen.web display:none/activityState. Em alguns builds
       * isso desincroniza do state do tab — URL/state mudam mas o frame não repinta.
       * false => MaybeScreen usa View + zIndex (focused=0, outros=-1), empilhamento fiável.
       */
      detachInactiveScreens={Platform.OS === 'web' ? false : undefined}
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
          tabBarButtonTestID: Platform.OS === 'web' ? 'tab-home' : undefined,
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
          tabBarButtonTestID: Platform.OS === 'web' ? 'tab-treino' : undefined,
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
          tabBarButtonTestID: Platform.OS === 'web' ? 'tab-nutricao' : undefined,
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
          tabBarButtonTestID: Platform.OS === 'web' ? 'tab-conversa' : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Coach', focused)} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Mais"
        component={MoreHubScreen}
        options={{
          title: 'Mais',
          tabBarButton: createTabButton('tab_mais', 'Mais', QA_ELEMENTS.tabMore),
          tabBarButtonTestID: Platform.OS === 'web' ? 'tab_mais' : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={getTabIcon('Mais', focused)} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
