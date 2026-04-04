export function getWeekBounds(dateKey) {
  const base = new Date(`${dateKey}T12:00:00`);
  const weekday = (base.getDay() + 6) % 7;

  const start = new Date(base);
  start.setDate(base.getDate() - weekday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const toDateKey = (value) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    startKey: toDateKey(start),
    endKey: toDateKey(end),
  };
}

export function getWorkoutDelta(current, previous) {
  if (!previous) {
    return null;
  }

  return {
    setsDiff: Number(current?.totalSets || 0) - Number(previous?.totalSets || 0),
    loadDiff: Number(current?.totalLoad || 0) - Number(previous?.totalLoad || 0),
  };
}
