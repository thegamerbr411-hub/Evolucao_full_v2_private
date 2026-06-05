import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCREENS, trackAppError } from '../../utils/analytics';
import { workoutDevLog } from '../../utils/workoutDevLog';
import {
  WORKOUT_DRAFT_BUNDLE_STORAGE_KEY,
  buildWorkoutDraftScopeKey,
  parseWorkoutDraftBundle,
  serializeWorkoutDraftBundle,
} from '../../services/workoutDraftStorage';

/** @deprecated legacy flat keys — migrated into bundle v2 */
export const WORKOUT_DRAFTS_STORAGE_KEY = '@workout:draft-sets-v1';
/** @deprecated legacy flat keys — migrated into bundle v2 */
export const WORKOUT_SET_COUNT_STORAGE_KEY = '@workout:set-count-v1';

/**
 * Hidrata/persiste rascunhos de séries escopados por dia + sessão + rotina.
 */
export function useWorkoutDraftPersistence({
  draftSetsByExercise,
  setDraftSetsByExercise,
  setCountByExercise,
  setSetCountByExercise,
  draftScopeKey = '',
  enabled = true,
}) {
  const didHydrateWorkoutDraftsRef = useRef(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const lastPersistedScopeRef = useRef('');

  useEffect(() => {
    let isMounted = true;

    const hydrateWorkoutDrafts = async () => {
      if (!enabled || !draftScopeKey) {
        didHydrateWorkoutDraftsRef.current = true;
        if (isMounted) {
          setIsDraftHydrated(true);
        }
        return;
      }

      try {
        workoutDevLog('HYDRATE_START', {
          keys: [WORKOUT_DRAFT_BUNDLE_STORAGE_KEY],
          scopeKey: draftScopeKey,
        });

        const [bundleRaw, legacyDraftRaw, legacySetCountRaw] = await Promise.all([
          AsyncStorage.getItem(WORKOUT_DRAFT_BUNDLE_STORAGE_KEY),
          AsyncStorage.getItem(WORKOUT_DRAFTS_STORAGE_KEY),
          AsyncStorage.getItem(WORKOUT_SET_COUNT_STORAGE_KEY),
        ]);

        if (!isMounted) {
          return;
        }

        const bundle = parseWorkoutDraftBundle(bundleRaw);
        if (bundle && bundle.scopeKey === draftScopeKey) {
          setDraftSetsByExercise(bundle.draftSetsByExercise);
          setSetCountByExercise(bundle.setCountByExercise);
          lastPersistedScopeRef.current = draftScopeKey;
        } else if (!bundle && (legacyDraftRaw || legacySetCountRaw)) {
          const legacyDrafts = legacyDraftRaw ? JSON.parse(legacyDraftRaw) : {};
          const legacySetCount = legacySetCountRaw ? JSON.parse(legacySetCountRaw) : {};
          if (legacyDrafts && typeof legacyDrafts === 'object') {
            setDraftSetsByExercise(legacyDrafts);
          }
          if (legacySetCount && typeof legacySetCount === 'object') {
            setSetCountByExercise(legacySetCount);
          }
          lastPersistedScopeRef.current = draftScopeKey;
        }

        workoutDevLog('HYDRATE_AFTER', {
          scopeKey: draftScopeKey,
          bundleMatched: Boolean(bundle && bundle.scopeKey === draftScopeKey),
        });
      } catch (error) {
        trackAppError(error, {
          screen: SCREENS.WORKOUT,
          action: 'hydrateWorkoutDrafts',
        });
      } finally {
        didHydrateWorkoutDraftsRef.current = true;
        if (isMounted) {
          setIsDraftHydrated(true);
        }
      }
    };

    didHydrateWorkoutDraftsRef.current = false;
    setIsDraftHydrated(false);
    hydrateWorkoutDrafts();

    return () => {
      isMounted = false;
    };
  }, [
    draftScopeKey,
    enabled,
    setDraftSetsByExercise,
    setSetCountByExercise,
  ]);

  useEffect(() => {
    if (!didHydrateWorkoutDraftsRef.current || !enabled || !draftScopeKey) {
      return;
    }

    const payload = serializeWorkoutDraftBundle({
      scopeKey: draftScopeKey,
      draftSetsByExercise,
      setCountByExercise,
    });

    workoutDevLog('PERSIST_BEFORE', {
      key: WORKOUT_DRAFT_BUNDLE_STORAGE_KEY,
      scopeKey: draftScopeKey,
      draftCount: Object.keys(draftSetsByExercise || {}).length,
      setCount: Object.keys(setCountByExercise || {}).length,
    });

    AsyncStorage.setItem(WORKOUT_DRAFT_BUNDLE_STORAGE_KEY, payload)
      .then(() => {
        lastPersistedScopeRef.current = draftScopeKey;
        workoutDevLog('PERSIST_AFTER', {
          success: true,
          key: WORKOUT_DRAFT_BUNDLE_STORAGE_KEY,
          scopeKey: draftScopeKey,
        });
      })
      .catch((error) => {
        workoutDevLog('PERSIST_AFTER', {
          success: false,
          key: WORKOUT_DRAFT_BUNDLE_STORAGE_KEY,
          message: error?.message || 'unknown',
        });
        trackAppError(error, {
          screen: SCREENS.WORKOUT,
          action: 'persistWorkoutDraftBundle',
        });
      });
  }, [draftSetsByExercise, setCountByExercise, draftScopeKey, enabled]);

  return { isDraftHydrated };
}

export { buildWorkoutDraftScopeKey };
