import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let Notifications = null;
try {
  // Import dinamico para manter compatibilidade em ambientes de teste sem runtime nativo.
  // eslint-disable-next-line global-require
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const NOTIFICATION_STATE_KEY = 'evolucao.notifications.state.v1';
const CREATINE_REMINDER_ID_KEY = 'evolucao.notifications.creatine.id.v1';
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
  if (!Notifications) {
    return { granted: false, reason: 'notifications_module_unavailable' };
  }

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
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch (_error) {
      // Evita quebra de boot em inconsistencias de canal no Android.
    }
  }

  return { granted: Boolean(granted) };
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

  if (!Notifications) {
    return { ok: false, reason: 'notifications_module_unavailable' };
  }

  const permission = await Notifications.getPermissionsAsync();
  const hasPermission = permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!hasPermission) {
    return { ok: false, reason: 'no_permission' };
  }

  try {
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
  } catch (_error) {
    return { ok: false, reason: 'schedule_failed' };
  }

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

export async function scheduleCreatineReminder({ hour = 9, minute = 0 } = {}) {
  if (!Notifications) {
    return { ok: false, reason: 'notifications_module_unavailable' };
  }

  const normalizedHour = Math.min(23, Math.max(0, Number(hour || 9)));
  const normalizedMinute = Math.min(59, Math.max(0, Number(minute || 0)));

  const permission = await initializeNotifications();
  if (!permission?.granted) {
    return { ok: false, reason: permission?.reason || 'no_permission' };
  }

  const previousId = await AsyncStorage.getItem(CREATINE_REMINDER_ID_KEY).catch(() => null);
  if (previousId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(previousId);
    } catch {
      // Se o id antigo nao existir, segue com novo agendamento.
    }
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hora da creatina',
        body: 'Lembrete diario: tome sua creatina e mantenha consistencia.',
        data: {
          type: 'creatine_reminder',
        },
        sound: Platform.OS === 'ios' ? 'default' : undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes?.DAILY ?? 'daily',
        hour: normalizedHour,
        minute: normalizedMinute,
      },
    });

    await AsyncStorage.setItem(CREATINE_REMINDER_ID_KEY, String(notificationId));

    return {
      ok: true,
      notificationId,
      hour: normalizedHour,
      minute: normalizedMinute,
    };
  } catch {
    return { ok: false, reason: 'schedule_failed' };
  }
}

export async function cancelCreatineReminder() {
  if (!Notifications) {
    return { ok: false, reason: 'notifications_module_unavailable' };
  }

  const previousId = await AsyncStorage.getItem(CREATINE_REMINDER_ID_KEY).catch(() => null);
  if (!previousId) {
    return { ok: true, alreadyDisabled: true };
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(previousId);
  } catch {
    // Mantem retorno ok para evitar quebrar UX em inconsistencias de id.
  }

  await AsyncStorage.removeItem(CREATINE_REMINDER_ID_KEY).catch(() => {});
  return { ok: true, alreadyDisabled: false };
}
