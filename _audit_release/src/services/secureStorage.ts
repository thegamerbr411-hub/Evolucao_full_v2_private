/**
 * Token / small secret persistence: SecureStore on native, localStorage on web.
 * Avoids ExpoSecureStore web shim errors (getValueWithKeyAsync is not a function).
 */
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const WEB_PREFIX = 'evolucao_secure_v1:'

function webKey(key: string) {
  return `${WEB_PREFIX}${key}`
}

export async function secureGetItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage === 'undefined') return null
      return localStorage.getItem(webKey(key))
    } catch {
      return null
    }
  }
  return SecureStore.getItemAsync(key)
}

export async function secureSetItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(webKey(key), value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

export async function secureDeleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(webKey(key))
      }
    } catch {
      // ignore
    }
    return
  }
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    // ignore
  }
}
