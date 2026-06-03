/**
 * Debug-only boot log for QA Visual Session env flags (emulator visual audits).
 * Never affects release behavior.
 */
export function isQaVisualSessionEnabled() {
  if (!__DEV__) return false;
  return (
    String(process.env.EXPO_PUBLIC_EVOLUCAO_QA_VISUAL_SESSION || '').trim() === '1' ||
    String(process.env.EXPO_PUBLIC_ANDROID_NAV_AUDIT || '').trim() === '1'
  );
}

export function logQaVisualSessionBoot() {
  if (!__DEV__) return;
  const enabled = isQaVisualSessionEnabled();
  console.log('[QA][VISUAL_SESSION] enabled=' + (enabled ? 'true' : 'false'));
  console.log('[QA][VISUAL_SESSION] source=env');
}
