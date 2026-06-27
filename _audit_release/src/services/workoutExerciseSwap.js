export const EXERCISE_SWAP_BUTTON_LABEL = 'Trocar exercicio';
export const EXERCISE_SWAP_CANCEL_LABEL = 'Cancelar';
export const EXERCISE_SWAP_TITLE = 'Trocar exercicio?';
export const EXERCISE_SWAP_HELPER_TEXT = 'Substitui so o exercicio atual';
export const EXERCISE_SWAP_PANEL_TITLE = 'Troca rapida do exercicio atual';

/** @deprecated Use buildExerciseSwapActionCopy().confirmLabel */
export const EXERCISE_SWAP_ACTION_LABEL = EXERCISE_SWAP_BUTTON_LABEL;

function normalizeName(value = '') {
  return String(value || '').trim();
}

function normalizeComparableName(value = '') {
  return normalizeName(value).toLowerCase();
}

function resolveExerciseDisplayName(value = '', fallback = 'este exercicio') {
  return normalizeName(value) || fallback;
}

function buildConfirmationMessage(oldName, newName, {
  hasSavedSets = false,
  hasDraftSets = false,
} = {}) {
  const safeOldName = resolveExerciseDisplayName(oldName, 'este exercicio');
  const safeNewName = resolveExerciseDisplayName(newName, 'outro exercicio');

  if (hasSavedSets) {
    let message = `Você já registrou séries em ${safeOldName}. Elas serão mantidas no histórico desse exercício e não serão transferidas para ${safeNewName}.`;
    if (hasDraftSets) {
      message += ' Os dados nao salvos do exercicio atual serao descartados.';
    }
    return message;
  }

  if (hasDraftSets) {
    return `Trocar ${safeOldName} por ${safeNewName}? Os dados nao salvos do exercicio atual serao descartados.`;
  }

  return '';
}

export function buildExerciseSwapActionCopy({
  currentExerciseName = '',
  replacementExerciseName = '',
  hasSavedSets = false,
  hasDraftSets = false,
  mode = 'advanced',
} = {}) {
  void mode;

  const oldName = resolveExerciseDisplayName(currentExerciseName, 'este exercicio');
  const newName = resolveExerciseDisplayName(replacementExerciseName, 'outro exercicio');
  const confirmationMessage = buildConfirmationMessage(oldName, newName, {
    hasSavedSets: Boolean(hasSavedSets),
    hasDraftSets: Boolean(hasDraftSets),
  });

  return {
    buttonLabel: EXERCISE_SWAP_BUTTON_LABEL,
    helperText: EXERCISE_SWAP_HELPER_TEXT,
    confirmationTitle: EXERCISE_SWAP_TITLE,
    confirmationMessage,
    cancelLabel: EXERCISE_SWAP_CANCEL_LABEL,
    confirmLabel: EXERCISE_SWAP_BUTTON_LABEL,
    successToast: `${oldName} substituido por ${newName} no treino de hoje.`,
    panelTitle: EXERCISE_SWAP_PANEL_TITLE,
  };
}

export function hasNonEmptyDraftRows(draftRows = []) {
  const safeRows = Array.isArray(draftRows) ? draftRows : [];
  return safeRows.some((row) => {
    const weight = String(row?.weight ?? '').trim();
    const reps = String(row?.reps ?? '').trim();
    return weight.length > 0 || reps.length > 0;
  });
}

export function countCompletedSetsForExercise(logs = [], exerciseName = '', matcher) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const targetName = normalizeName(exerciseName);
  if (!targetName) {
    return 0;
  }

  if (typeof matcher === 'function') {
    return safeLogs.filter((entry) => matcher(entry, targetName)).length;
  }

  return safeLogs.filter((entry) => normalizeComparableName(entry?.exerciseName) === normalizeComparableName(targetName)).length;
}

export function formatExerciseSwapConfirmationMessage(oldName, newName, {
  hasCompletedSets = false,
  hasDraftSets = false,
} = {}) {
  return buildExerciseSwapActionCopy({
    currentExerciseName: oldName,
    replacementExerciseName: newName,
    hasSavedSets: hasCompletedSets,
    hasDraftSets,
  }).confirmationMessage;
}

export function buildExerciseSwapPlan({
  currentExercise,
  replacementExercise,
  exerciseIndex,
  totalExercises,
  hasCompletedSets = false,
  hasDraftSets = false,
} = {}) {
  const currentName = normalizeName(currentExercise?.name);
  const replacementName = normalizeName(replacementExercise?.name);
  const safeIndex = Number(exerciseIndex);
  const safeTotal = Number(totalExercises);

  if (!currentName) {
    return { ok: false, error: 'missing_current_exercise' };
  }

  if (!replacementName) {
    return { ok: false, error: 'missing_replacement_exercise' };
  }

  if (!Number.isFinite(safeIndex) || safeIndex < 0 || safeIndex >= safeTotal) {
    return { ok: false, error: 'invalid_exercise_index' };
  }

  if (normalizeComparableName(currentName) === normalizeComparableName(replacementName)) {
    return { ok: false, error: 'same_exercise' };
  }

  const requiresConfirmation = Boolean(hasCompletedSets || hasDraftSets);
  const warnings = [];

  if (hasCompletedSets) {
    warnings.push('completed_sets_preserved_on_previous_exercise');
  }

  if (hasDraftSets) {
    warnings.push('unsaved_draft_will_be_discarded');
  }

  const copy = buildExerciseSwapActionCopy({
    currentExerciseName: currentName,
    replacementExerciseName: replacementName,
    hasSavedSets: hasCompletedSets,
    hasDraftSets,
  });

  return {
    ok: true,
    requiresConfirmation,
    title: copy.confirmationTitle,
    message: copy.confirmationMessage,
    actionLabel: copy.confirmLabel,
    confirmLabel: copy.confirmLabel,
    cancelLabel: copy.cancelLabel,
    buttonLabel: copy.buttonLabel,
    helperText: copy.helperText,
    successToast: copy.successToast,
    panelTitle: copy.panelTitle,
    preserveExistingSets: true,
    transferLogsToNewExercise: false,
    clearDraftForPreviousExercise: Boolean(hasDraftSets),
    replacement: {
      ...replacementExercise,
      name: replacementName,
    },
    oldExerciseName: currentName,
    newExerciseName: replacementName,
    exerciseIndex: safeIndex,
    totalExercises: safeTotal,
    hasCompletedSets: Boolean(hasCompletedSets),
    hasDraftSets: Boolean(hasDraftSets),
    warnings,
  };
}

export function applyExerciseSwapToWorkout({
  exercises,
  exerciseIndex,
  replacementExercise,
} = {}) {
  const safeExercises = Array.isArray(exercises) ? exercises : [];
  const safeIndex = Number(exerciseIndex);
  const replacementName = normalizeName(replacementExercise?.name);

  if (!replacementName) {
    return { ok: false, error: 'missing_replacement_exercise' };
  }

  if (!Number.isFinite(safeIndex) || safeIndex < 0 || safeIndex >= safeExercises.length) {
    return { ok: false, error: 'invalid_exercise_index' };
  }

  const currentExercise = safeExercises[safeIndex];
  if (!currentExercise) {
    return { ok: false, error: 'missing_current_exercise' };
  }

  const nextExercises = safeExercises.map((item, index) => {
    if (index !== safeIndex) {
      return item;
    }

    const nextId = replacementExercise?.id
      || `${replacementName}-${index}`;

    return {
      ...item,
      ...replacementExercise,
      name: replacementName,
      id: nextId,
    };
  });

  return {
    ok: true,
    exercises: nextExercises,
    exerciseCount: nextExercises.length,
    exerciseIndex: safeIndex,
    oldExerciseName: normalizeName(currentExercise?.name),
    newExerciseName: replacementName,
  };
}

export function migrateSetCountForSwap({
  setCountByExercise = {},
  oldExerciseName,
  newExerciseName,
} = {}) {
  const safeMap = setCountByExercise && typeof setCountByExercise === 'object'
    ? { ...setCountByExercise }
    : {};
  const oldName = normalizeName(oldExerciseName);
  const newName = normalizeName(newExerciseName);

  if (!oldName || !newName || oldName === newName) {
    return safeMap;
  }

  if (Object.prototype.hasOwnProperty.call(safeMap, oldName)) {
    safeMap[newName] = safeMap[oldName];
    delete safeMap[oldName];
  }

  return safeMap;
}

export function buildDraftCleanupForSwap({
  oldExerciseName,
  hasDraftSets = false,
} = {}) {
  const oldName = normalizeName(oldExerciseName);
  if (!oldName || !hasDraftSets) {
    return {};
  }

  return { [oldName]: undefined };
}
