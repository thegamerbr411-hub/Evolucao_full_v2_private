import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { SCREENS, trackAppError } from '../../utils/analytics';

export const WORKOUT_REST_END_STORAGE_KEY = '@workout:rest-timer-end-v1';

/**
 * Timer de descanso entre séries: persistência, countdown e feedback háptico.
 * Extraído de WorkoutScreen para reduzir monólito e facilitar testes.
 */
export function useWorkoutRestTimer() {
  const lastCountdownTickRef = useRef(null);
  const [restPreset, setRestPreset] = useState(60);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restEndAt, setRestEndAt] = useState(null);
  const [restDoneMessage, setRestDoneMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const hydrateRestTimer = async () => {
      try {
        const endRaw = await AsyncStorage.getItem(WORKOUT_REST_END_STORAGE_KEY);
        if (!isMounted || !endRaw) {
          return;
        }

        const parsedEnd = Number(endRaw);
        if (!Number.isFinite(parsedEnd)) {
          return;
        }

        const remainingSeconds = Math.max(0, Math.ceil((parsedEnd - Date.now()) / 1000));
        if (remainingSeconds > 0) {
          setRestEndAt(parsedEnd);
          setRestSeconds(remainingSeconds);
          setRestRunning(true);
        } else {
          await AsyncStorage.removeItem(WORKOUT_REST_END_STORAGE_KEY);
        }
      } catch (error) {
        trackAppError(error, {
          screen: SCREENS.WORKOUT,
          action: 'hydrateRestTimer',
        });
      }
    };

    hydrateRestTimer();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (restRunning && restEndAt) {
      AsyncStorage.setItem(WORKOUT_REST_END_STORAGE_KEY, String(restEndAt)).catch((error) => {
        trackAppError(error, {
          screen: SCREENS.WORKOUT,
          action: 'persistRestTimerEnd',
        });
      });
      return;
    }

    AsyncStorage.removeItem(WORKOUT_REST_END_STORAGE_KEY).catch((error) => {
      trackAppError(error, {
        screen: SCREENS.WORKOUT,
        action: 'clearRestTimerEnd',
      });
    });
  }, [restRunning, restEndAt]);

  useEffect(() => {
    if (!restRunning || !restEndAt) {
      lastCountdownTickRef.current = null;
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000));
      setRestSeconds(remaining);

      if (remaining <= 0) {
        setRestRunning(false);
        setRestEndAt(null);
        lastCountdownTickRef.current = null;
        Vibration.vibrate(500);
        setRestDoneMessage('Descanso concluido. Proxima serie liberada.');
        return;
      }

      if (remaining <= 5 && lastCountdownTickRef.current !== remaining) {
        lastCountdownTickRef.current = remaining;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);
    return () => clearInterval(intervalId);
  }, [restRunning, restEndAt]);

  useEffect(() => {
    if (!restDoneMessage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRestDoneMessage('');
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [restDoneMessage]);

  const startRestTimer = useCallback((seconds) => {
    const safeSeconds = Math.max(1, Number(seconds ?? (restPreset || 0)));
    Vibration.vibrate(80);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestSeconds(safeSeconds);
    setRestEndAt(Date.now() + safeSeconds * 1000);
    setRestRunning(true);
  }, [restPreset]);

  const skipRest = useCallback(() => {
    setRestRunning(false);
    setRestSeconds(0);
    setRestEndAt(null);
  }, []);

  const extendRestByThirty = useCallback(() => {
    const baseEnd = Number(restEndAt || Date.now());
    const nextEnd = baseEnd + 30000;
    setRestEndAt(nextEnd);
    setRestSeconds(Math.max(0, Math.ceil((nextEnd - Date.now()) / 1000)));
  }, [restEndAt]);

  return {
    restPreset,
    setRestPreset,
    restSeconds,
    restRunning,
    restEndAt,
    restDoneMessage,
    startRestTimer,
    skipRest,
    extendRestByThirty,
  };
}
