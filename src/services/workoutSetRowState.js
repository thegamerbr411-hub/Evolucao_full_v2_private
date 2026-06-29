import { validateWorkoutSetInput } from './workoutInputValidation.js';

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

function buildPendingState({ label = 'Pendente', helperText = '' } = {}) {
  return {
    status: 'pending',
    label,
    actionLabel: '',
    canSave: false,
    showAction: false,
    accessibilityLabel: label,
    helperText,
  };
}

function buildSavedState() {
  return {
    status: 'saved',
    label: 'Salva',
    actionLabel: '',
    canSave: false,
    showAction: true,
    accessibilityLabel: 'Série salva',
    helperText: '',
  };
}

function buildInvalidState() {
  return {
    status: 'invalid',
    label: 'Inválida',
    actionLabel: '',
    canSave: false,
    showAction: false,
    accessibilityLabel: 'Série inválida. Confira carga e reps',
    helperText: 'Confira carga e reps',
  };
}

function buildReadyState() {
  return {
    status: 'ready',
    label: 'Pronta',
    actionLabel: 'Salvar série',
    canSave: true,
    showAction: true,
    accessibilityLabel: 'Salvar série',
    helperText: '',
  };
}

export function buildWorkoutSetRowState({
  weight = '',
  reps = '',
  rpe = '8',
  isSaved = false,
  isFuture = false,
  isActiveSet = false,
  isCardio = false,
} = {}) {
  if (Boolean(isSaved)) {
    return buildSavedState();
  }

  if (Boolean(isFuture)) {
    return buildPendingState();
  }

  const weightBlank = isBlank(weight);
  const repsBlank = isBlank(reps);

  if (weightBlank && repsBlank) {
    return buildPendingState();
  }

  const validation = validateWorkoutSetInput({
    weight,
    reps,
    rpe,
    isCardio: Boolean(isCardio),
  });

  if (!validation.ok) {
    return buildInvalidState();
  }

  if (Boolean(isActiveSet)) {
    return buildReadyState();
  }

  return buildPendingState();
}
