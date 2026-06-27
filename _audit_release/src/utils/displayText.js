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

/** pt-BR count + noun with simple singular/plural (e.g. 1 treino / 2 treinos). */
export function formatCountPt(count, singular, plural) {
  const n = Math.max(0, Number(count) || 0);
  const pluralForm = plural || `${singular}s`;
  const word = n === 1 ? singular : pluralForm;
  return `${n} ${word}`;
}

const TECHNICAL_UID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;

export function looksLikeTechnicalUserId(value = '') {
  const safe = String(value || '').trim();
  return Boolean(safe && TECHNICAL_UID_PATTERN.test(safe));
}

export function formatSocialParticipantLabel(rank, displayName = '') {
  const safeName = normalizeDisplayName(displayName);
  if (safeName && !looksLikeTechnicalUserId(safeName)) {
    return safeName;
  }
  const safeRank = Math.max(1, Number(rank) || 1);
  return `Participante #${safeRank}`;
}
