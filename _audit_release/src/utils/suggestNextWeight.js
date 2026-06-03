export function suggestNextWeight(lastWeight) {
  if (!lastWeight || isNaN(lastWeight)) return 10;
  return Math.round((lastWeight + Math.max(2.5, lastWeight * 0.05)) * 2) / 2;
}
