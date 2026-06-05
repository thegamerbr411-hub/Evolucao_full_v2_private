export const WATER_MAX_SINGLE_ML = 3000;
export const WATER_QUICK_OPTIONS_ML = [200, 300, 500, 510];

export function buildWaterQuickOptions() {
  return [...WATER_QUICK_OPTIONS_ML];
}

export function normalizeWaterAmount(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Math.round(Number(trimmed.replace(',', '.')));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function validateWaterAmount(value) {
  const amountMl = normalizeWaterAmount(value);
  if (amountMl === null) {
    return { ok: false, reason: 'empty' };
  }
  if (amountMl <= 0) {
    return { ok: false, reason: amountMl === 0 ? 'zero' : 'negative' };
  }
  if (amountMl > WATER_MAX_SINGLE_ML) {
    return { ok: false, reason: 'absurd' };
  }
  return { ok: true, amountMl };
}

export function buildWaterRegisterCopy(amountMl) {
  const safe = Math.round(Number(amountMl || 0));
  return `Água registrada: ${safe} ml`;
}

export function buildWaterFeedbackCopy(amountMl) {
  const safe = Math.round(Number(amountMl || 0));
  return `+${safe}ml adicionados 💧`;
}

export function isPresetWaterAmount(value) {
  const amountMl = normalizeWaterAmount(value);
  return amountMl !== null && WATER_QUICK_OPTIONS_ML.includes(amountMl);
}
