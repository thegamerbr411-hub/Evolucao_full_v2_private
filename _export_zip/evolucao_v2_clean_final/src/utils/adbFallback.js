export function isAdbAvailable() {
  try {
    if (typeof process === 'undefined' || !process?.env) {
      return false;
    }

    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
    const path = process.env.PATH || '';
    return path.toLowerCase().includes('platform-tools') || androidHome.length > 0;
  } catch (_error) {
    return false;
  }
}

export function getAdbSafeMessage() {
  return isAdbAvailable()
    ? 'adb disponivel para automacao.'
    : 'adb nao detectado. Rode npm run fix:adb para configurar automaticamente.';
}
