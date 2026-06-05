import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCREENS, trackAppError } from '../../utils/analytics';
import { workoutDevLog } from '../../utils/workoutDevLog';

/** Índice do exercício visível + modo simples (restore após kill / activity death). */
export const WORKOUT_UI_SESSION_STORAGE_KEY = '@workout:ui-session-v1';

/**
 * Hidrata/persiste estado leve de UI do treino (não substitui logs de séries concluídas).
 * Só persiste quando `hasExercises` é true para não gravar snapshot antes do treino existir.
 */
export function useWorkoutSessionUiPersistence({
  activeExerciseIndex,
  setActiveExerciseIndex,
  simpleMode,
  setSimpleMode,
  hasExercises,
  workoutSessionId = null,
  sessionDayKey = '',
}) {
  const didHydrateRef = useRef(false);
  const [isUiSessionHydrated, setIsUiSessionHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        workoutDevLog('HYDRATE_START', { keys: [WORKOUT_UI_SESSION_STORAGE_KEY] });
        const raw = await AsyncStorage.getItem(WORKOUT_UI_SESSION_STORAGE_KEY);
        workoutDevLog('HYDRATE_PAYLOAD', {
          key: WORKOUT_UI_SESSION_STORAGE_KEY,
          found: Boolean(raw),
          size: raw ? String(raw).length : 0,
        });
        if (!alive) {
          return;
        }
        if (!raw) {
          didHydrateRef.current = true;
          if (alive) {
            setIsUiSessionHydrated(true);
          }
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.simpleMode === 'boolean') {
            setSimpleMode(parsed.simpleMode);
          }
          const idx = Number(parsed.activeExerciseIndex);
          if (Number.isFinite(idx) && idx >= 0) {
            setActiveExerciseIndex(idx);
          }
          workoutDevLog('HYDRATE_AFTER', {
            key: WORKOUT_UI_SESSION_STORAGE_KEY,
            activeExerciseIndex: Number(parsed.activeExerciseIndex || 0),
            simpleMode: Boolean(parsed.simpleMode),
            workoutSessionId: parsed.workoutSessionId || null,
            sessionDayKey: parsed.sessionDayKey || null,
          });
        }
      } catch (error) {
        trackAppError(error, {
          screen: SCREENS.WORKOUT,
          action: 'hydrateWorkoutUiSession',
        });
      } finally {
        didHydrateRef.current = true;
        if (alive) {
          setIsUiSessionHydrated(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [setActiveExerciseIndex, setSimpleMode]);

  useEffect(() => {
    if (!didHydrateRef.current || !hasExercises) {
      return;
    }
    const payload = JSON.stringify({
      activeExerciseIndex,
      simpleMode,
      workoutSessionId: workoutSessionId || null,
      sessionDayKey: sessionDayKey || null,
    });
    workoutDevLog('PERSIST_BEFORE', {
      key: WORKOUT_UI_SESSION_STORAGE_KEY,
      activeExerciseIndex,
      simpleMode,
      workoutSessionId: workoutSessionId || null,
      sessionDayKey: sessionDayKey || null,
    });
    AsyncStorage.setItem(WORKOUT_UI_SESSION_STORAGE_KEY, payload)
      .then(() => {
        workoutDevLog('PERSIST_AFTER', {
          success: true,
          key: WORKOUT_UI_SESSION_STORAGE_KEY,
          size: payload.length,
        });
      })
      .catch((error) => {
        workoutDevLog('PERSIST_AFTER', {
          success: false,
          key: WORKOUT_UI_SESSION_STORAGE_KEY,
          message: error?.message || 'unknown',
        });
        trackAppError(error, {
          screen: SCREENS.WORKOUT,
          action: 'persistWorkoutUiSession',
        });
      });
  }, [activeExerciseIndex, simpleMode, hasExercises, workoutSessionId, sessionDayKey]);

  return { isUiSessionHydrated };
}
