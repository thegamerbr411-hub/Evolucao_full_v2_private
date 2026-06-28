function hasUsableSetValues(weight, reps) {
  return String(weight ?? '').trim() !== '' || String(reps ?? '').trim() !== '';
}

export function formatPreviousSetLabel({ weight, reps, isCardio } = {}) {
  if (!hasUsableSetValues(weight, reps)) {
    return '—';
  }

  const safeWeight = String(weight ?? '').trim();
  const safeReps = String(reps ?? '').trim();

  if (Boolean(isCardio)) {
    if (safeReps && safeWeight) {
      return `${safeReps} min · ${safeWeight} km`;
    }
    return '—';
  }

  if (safeWeight && safeReps) {
    return `${safeWeight} kg × ${safeReps}`;
  }

  return '—';
}

export function resolvePreviousSetForRow({
  setIndex,
  todaySets,
  lastHistoricalSet,
  isCardio,
} = {}) {
  const idx = Math.max(0, Number(setIndex) || 0);

  if (idx > 0 && Array.isArray(todaySets)) {
    const previous = todaySets[idx - 1];
    if (previous && Boolean(previous.done)) {
      const label = formatPreviousSetLabel({
        weight: previous.weight,
        reps: previous.reps,
        isCardio,
      });
      if (label !== '—') {
        return label;
      }
    }
  }

  if (idx === 0 && lastHistoricalSet && typeof lastHistoricalSet === 'object') {
    const label = formatPreviousSetLabel({
      weight: lastHistoricalSet.weight,
      reps: lastHistoricalSet.reps,
      isCardio,
    });
    if (label !== '—') {
      return label;
    }
  }

  return '—';
}
