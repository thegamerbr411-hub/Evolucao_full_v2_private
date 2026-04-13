import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_VERSION = 1;

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getJsonItem(key) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return null;
  }

  const parsed = safeParse(raw);
  if (!parsed) {
    return null;
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    Object.prototype.hasOwnProperty.call(parsed, 'version') &&
    Object.prototype.hasOwnProperty.call(parsed, 'data')
  ) {
    return parsed.data;
  }

  // Backward compatibility with legacy payloads without envelope.
  return parsed;
}

export async function setJsonItem(key, value) {
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      version: STORAGE_VERSION,
      data: value,
    })
  );
}

export async function removeItem(key) {
  await AsyncStorage.removeItem(key);
}
