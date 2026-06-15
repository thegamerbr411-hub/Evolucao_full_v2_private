export function decodeDisplayText(value) {
  const raw = value == null ? '' : String(value);
  if (!raw) {
    return '';
  }
  if (!raw.includes('%')) {
    return raw;
  }

  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw.replace(/%20/gi, ' ');
  }
}

export function normalizeDisplayName(value) {
  return decodeDisplayText(value).replace(/\s+/g, ' ').trim();
}

export function formatExerciseName(value) {
  const normalized = normalizeDisplayName(value);
  return normalized || 'Exercício';
}
