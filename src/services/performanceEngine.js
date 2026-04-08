export const calculate1RM = (weight, reps) => {
  const safeWeight = Number(weight || 0);
  const safeReps = Number(reps || 0);

  if (!Number.isFinite(safeWeight) || !Number.isFinite(safeReps) || safeWeight <= 0 || safeReps <= 0 || safeReps >= 37) {
    return 0;
  }

  return safeWeight * (36 / (37 - safeReps));
};

export const calculateVolume = (sets) => {
  if (!Array.isArray(sets)) {
    return 0;
  }

  return sets.reduce((acc, setItem) => {
    const weight = Number(setItem?.weight || 0);
    const reps = Number(setItem?.reps || 0);
    if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
      return acc;
    }
    return acc + (weight * reps);
  }, 0);
};

export const calculateSRPE = (rpe, durationMinutes) => {
  const safeRpe = Number(rpe || 0);
  const safeDuration = Number(durationMinutes || 0);

  if (!Number.isFinite(safeRpe) || !Number.isFinite(safeDuration) || safeRpe <= 0 || safeDuration <= 0) {
    return 0;
  }

  return safeRpe * safeDuration;
};

export const getProgression = (lastReps, targetReps, weight) => {
  const safeLastReps = Number(lastReps || 0);
  const safeTargetReps = Number(targetReps || 0);
  const safeWeight = Number(weight || 0);

  if (!Number.isFinite(safeWeight) || safeWeight <= 0) {
    return 0;
  }

  if (safeLastReps >= safeTargetReps && safeTargetReps > 0) {
    return safeWeight * 1.025;
  }

  return safeWeight;
};

export const getDailyPriority = ({ trained, protein, water, goalProtein = 150, waterGoal = 2000 }) => {
  if (!trained) return 'Treinar';
  if (Number(protein || 0) < Number(goalProtein || 150)) return 'Bater proteína';
  if (Number(water || 0) < Number(waterGoal || 2000)) return 'Beber água';
  return 'Recuperar';
};
