import { logError } from './crashlytics.js';

export const safeExecute = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (error) {
    logError(error);
    console.error('ERROR:', error);
    return fallback;
  }
};
