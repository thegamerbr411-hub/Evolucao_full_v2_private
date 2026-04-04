import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const NOTIFICATION_STATE_KEY = 'evolucao.notifications.state.v1';
const MAX_NOTIFICATIONS_PER_DAY = 2;

let handlerConfigured = false;

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadNotificationState() {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_STATE_KEY);
    if (!raw) {
      return { byDay: {} };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { byDay: {} };
    }

    return {
      byDay: parsed.byDay && typeof parsed.byDay === 'object' ? parsed.byDay : {},
    };
  } catch (_error) {
    return { byDay: {} };
  }
}

async function saveNotificationState(state) {
  try {
    await AsyncStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(state));
  } catch (_error) {
    // Ignora falhas locais para nao travar UX.
  }
}

export async function initializeNotifications() {
  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let granted = permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const request = await Notifications.requestPermissionsAsync();
    granted = request.granted || request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return { granted };
}

export async function sendIntelligentNotification({
  eventKey,
  title,
  body,
  data = {},
  delaySeconds = 1,
}) {
  if (!eventKey || !title || !body) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const todayKey = getTodayKey();
  const state = await loadNotificationState();
  const dayState = state.byDay[todayKey] || { count: 0, keys: [] };

  if (Array.isArray(dayState.keys) && dayState.keys.includes(eventKey)) {
    return { ok: false, reason: 'already_sent' };
  }

  if (Number(dayState.count || 0) >= MAX_NOTIFICATIONS_PER_DAY) {
    return { ok: false, reason: 'daily_limit' };
  }

  const permission = await Notifications.getPermissionsAsync();
  const hasPermission = permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!hasPermission) {
    return { ok: false, reason: 'no_permission' };
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: Platform.OS === 'ios' ? 'default' : undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Number(delaySeconds || 1)),
      repeats: false,
    },
  });

  const nextState = {
    ...state,
    byDay: {
      ...state.byDay,
      [todayKey]: {
        count: Number(dayState.count || 0) + 1,
        keys: [...(Array.isArray(dayState.keys) ? dayState.keys : []), eventKey],
      },
    },
  };

  await saveNotificationState(nextState);

  return { ok: true };
}
