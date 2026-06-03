/** Conservative limits — adjustable later without changing call sites. */
export const WORKOUT_SET_LIMITS = {
  weightMin: 0,
  weightMax: 300,
  repsMin: 1,
  repsMax: 100,
  rpeMin: 1,
  rpeMax: 10,
};

const MESSAGES = {
  weight: 'Carga invalida. Use um valor entre 0 e 300kg.',
  reps: 'Repeticoes invalidas. Use um valor entre 1 e 100.',
  rpe: 'RPE invalido. Use um valor entre 1 e 10.',
};

export function parseWorkoutNumeric(value) {
  const raw = String(value ?? '').replace(',', '.').trim();
  if (!raw) {
    return NaN;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

function validateWeightField(weight, { isCardio = false } = {}) {
  if (isCardio && isBlank(weight)) {
    return { ok: true, value: 0 };
  }
  if (isBlank(weight)) {
    return { ok: false, message: MESSAGES.weight };
  }
  const parsed = parseWorkoutNumeric(weight);
  if (!Number.isFinite(parsed) || parsed < WORKOUT_SET_LIMITS.weightMin || parsed > WORKOUT_SET_LIMITS.weightMax) {
    return { ok: false, message: MESSAGES.weight };
  }
  return { ok: true, value: parsed };
}

function validateRepsField(reps) {
  if (isBlank(reps)) {
    return { ok: false, message: MESSAGES.reps };
  }
  const parsed = parseWorkoutNumeric(reps);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < WORKOUT_SET_LIMITS.repsMin || parsed > WORKOUT_SET_LIMITS.repsMax) {
    return { ok: false, message: MESSAGES.reps };
  }
  return { ok: true, value: parsed };
}

function validateRpeField(rpe) {
  if (isBlank(rpe)) {
    return { ok: true, value: undefined };
  }
  const parsed = parseWorkoutNumeric(rpe);
  if (!Number.isFinite(parsed) || parsed < WORKOUT_SET_LIMITS.rpeMin || parsed > WORKOUT_SET_LIMITS.rpeMax) {
    return { ok: false, message: MESSAGES.rpe };
  }
  return { ok: true, value: parsed };
}

/**
 * Validates workout set input before persistence.
 * @returns {{ ok: boolean, sanitized: { weight: number, reps: number, rpe?: number }, errors: Array<{ field: string, message: string }> }}
 */
export function validateWorkoutSetInput({ weight, reps, rpe, isCardio = false } = {}) {
  const errors = [];

  const weightResult = validateWeightField(weight, { isCardio });
  if (!weightResult.ok) {
    errors.push({ field: 'weight', message: weightResult.message });
  }

  const repsResult = validateRepsField(reps);
  if (!repsResult.ok) {
    errors.push({ field: 'reps', message: repsResult.message });
  }

  const rpeResult = validateRpeField(rpe);
  if (!rpeResult.ok) {
    errors.push({ field: 'rpe', message: rpeResult.message });
  }

  if (errors.length > 0) {
    return { ok: false, sanitized: null, errors };
  }

  const sanitized = {
    weight: weightResult.value,
    reps: repsResult.value,
  };
  if (rpeResult.value !== undefined) {
    sanitized.rpe = rpeResult.value;
  }

  return { ok: true, sanitized, errors: [] };
}

export function getWorkoutSetValidationToast(errors = []) {
  const first = Array.isArray(errors) ? errors.find((item) => item?.message) : null;
  return first?.message || 'Preencha peso e repeticoes validas.';
}

export function isPlausibleStoredWorkoutSet(log, { isCardio = false } = {}) {
  if (!log || typeof log !== 'object') {
    return false;
  }
  return validateWorkoutSetInput({
    weight: log.weight,
    reps: log.reps,
    rpe: log.rpe,
    isCardio,
  }).ok;
}

export function filterPlausibleWorkoutLogs(logs = [], options = {}) {
  const safe = Array.isArray(logs) ? logs : [];
  return safe.filter((item) => isPlausibleStoredWorkoutSet(item, options));
}
