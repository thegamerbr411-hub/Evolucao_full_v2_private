export function calcEvolution(prev, curr) {
  if (!prev || prev === 0) return 100;
  return Math.round(((curr - prev) / prev) * 100);
}
