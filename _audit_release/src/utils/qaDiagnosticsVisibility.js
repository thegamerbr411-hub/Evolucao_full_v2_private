export function shouldShowQaDiagnostics() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
