export function workoutDevLog(tag, payload) {
  if (!__DEV__) return;
  try {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    console.log(`[WORKOUT][${String(tag || 'UNKNOWN')}] ${body}`);
  } catch (error) {
    console.log(`[WORKOUT][${String(tag || 'UNKNOWN')}]`, payload);
  }
}
