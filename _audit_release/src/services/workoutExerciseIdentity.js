function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const normalizeExerciseLabel = (value = '') => normalize(value).replace(/\s+/g, ' ').trim();

export const resolveExerciseIdentity = (exerciseName = '', exerciseId = '') => ({
  exerciseId: String(exerciseId || '').trim(),
  normalizedName: normalizeExerciseLabel(exerciseName),
});

export const matchesExerciseLog = (log = {}, identity = {}) => {
  if (!log || !identity) return false;

  const logId = String(log.exerciseId || '').trim();
  const identityId = String(identity.exerciseId || '').trim();
  const logName = normalizeExerciseLabel(log.exerciseName || '');
  const identityName = identity.normalizedName || '';

  if (logId && identityId) {
    return logId === identityId;
  }

  if (identityId) {
    return logId ? logId === identityId : logName === identityName;
  }

  return logName === identityName;
};

export const filterLogsByExercise = (logs = [], identity = {}) =>
  (Array.isArray(logs) ? logs : []).filter((item) => matchesExerciseLog(item, identity));
