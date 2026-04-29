export const APP_VERSION = String(
  (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_APP_VERSION : '')
  || (typeof process !== 'undefined' ? process?.env?.APP_VERSION : '')
  || '1.1.0'
).trim();

export const BUILD_VERSION = String(
  (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_BUILD_VERSION : '')
  || APP_VERSION
).trim();
