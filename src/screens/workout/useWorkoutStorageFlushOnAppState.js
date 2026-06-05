import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCREENS, trackAppError } from '../../utils/analytics';
import { workoutDevLog } from '../../utils/workoutDevLog';
import {
  WORKOUT_DRAFTS_STORAGE_KEY,
  WORKOUT_SET_COUNT_STORAGE_KEY,
} from './useWorkoutDraftPersistence';
import { WORKOUT_UI_SESSION_STORAGE_KEY } from './useWorkoutSessionUiPersistence';

/**
 * Garante escrita imediata de drafts + UI session ao ir para background/inactive,
 * reduzindo janela de perda se o SO matar o processo antes do próximo ciclo de persistência.
 */
export function useWorkoutStorageFlushOnAppState({
  enabled,
  draftSetsByExercise,
  setCountByExercise,
  activeExerciseIndex,
  simpleMode,
}) {
  const snapshotRef = useRef({
    draftSetsByExercise: {},
    setCountByExercise: {},
    activeExerciseIndex: 0,
    simpleMode: true,
  });

  useEffect(() => {
    snapshotRef.current = {
      draftSetsByExercise,
      setCountByExercise,
      activeExerciseIndex,
      simpleMode,
    };
  }, [draftSetsByExercise, setCountByExercise, activeExerciseIndex, simpleMode]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const flush = () => {
      const s = snapshotRef.current;
      return AsyncStorage.multiSet([
        [WORKOUT_DRAFTS_STORAGE_KEY, JSON.stringify(s.draftSetsByExercise || {})],
        [WORKOUT_SET_COUNT_STORAGE_KEY, JSON.stringify(s.setCountByExercise || {})],
        [
          WORKOUT_UI_SESSION_STORAGE_KEY,
          JSON.stringify({
            activeExerciseIndex: s.activeExerciseIndex,
            simpleMode: s.simpleMode,
          }),
        ],
      ]);
    };

    const onChange = (nextState) => {
      if (nextState !== 'background' && nextState !== 'inactive') {
        return;
      }
      const snapshot = snapshotRef.current || {};
      workoutDevLog('PERSIST_BEFORE', {
        key: WORKOUT_UI_SESSION_STORAGE_KEY,
        source: 'app_state_flush',
        draftCount: Object.keys(snapshot.draftSetsByExercise || {}).length,
        setCount: Object.keys(snapshot.setCountByExercise || {}).length,
      });
      flush()
        .then(() => {
          workoutDevLog('PERSIST_AFTER', {
            success: true,
            key: WORKOUT_UI_SESSION_STORAGE_KEY,
            source: 'app_state_flush',
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
            action: 'appStateFlushWorkoutStorage',
          });
        });
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled]);
}
