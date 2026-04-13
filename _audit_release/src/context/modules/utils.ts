export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

export const round = (value: number, decimals = 0): number => {
  const factor = Math.pow(10, Math.max(0, decimals));
  return Math.round((Number(value) || 0) * factor) / factor;
};

export const roundToStep = (value: number, step = 1): number => {
  const safeStep = Math.max(0.0001, Number(step) || 1);
  return round(Math.round((Number(value) || 0) / safeStep) * safeStep, 4);
};

export const getTodayKey = (): string => {
  return new Date().toISOString().slice(0, 10);
};

export const getPreviousDateKey = (dateKey?: string): string => {
  const base = dateKey ? new Date(`${dateKey}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    return getTodayKey();
  }
  base.setDate(base.getDate() - 1);
  return base.toISOString().slice(0, 10);
};

export const normalizeHistoryStatus = (status?: string): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'done' || normalized === 'completed' || normalized === 'finished') {
    return 'completed';
  }
  if (normalized === 'skip' || normalized === 'skipped') {
    return 'skipped';
  }
  if (normalized === 'failed' || normalized === 'error') {
    return 'failed';
  }
  return normalized || 'pending';
};
