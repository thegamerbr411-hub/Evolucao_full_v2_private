let crashlyticsModule = null;

try {
  // Lazy load para evitar quebrar ambiente sem modulo nativo instalado.
  const loaded = require('@react-native-firebase/crashlytics');
  crashlyticsModule = loaded?.default || loaded;
} catch (_error) {
  crashlyticsModule = null;
}

export const logError = (error) => {
  if (crashlyticsModule) {
    crashlyticsModule().recordError(error);
    return;
  }

  console.error('Crashlytics ausente, erro local:', error);
};

export const logMessage = (message) => {
  if (crashlyticsModule) {
    crashlyticsModule().log(String(message || ''));
    return;
  }

  console.log('Crashlytics ausente, log local:', message);
};
