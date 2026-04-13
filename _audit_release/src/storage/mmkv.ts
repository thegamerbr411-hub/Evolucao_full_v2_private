// src/storage/mmkv.ts
import { MMKV } from 'react-native-mmkv'

export const storage = new MMKV({
  id: 'evolucao-app',
})

/**
 * Funções helper para storage local
 */
export const setLocal = (key: string, value: any): void => {
  try {
    storage.set(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Error saving ${key}:`, e)
  }
}

export const getLocal = (key: string): any => {
  try {
    const value = storage.getString(key)
    return value ? JSON.parse(value) : null
  } catch (e) {
    console.error(`Error getting ${key}:`, e)
    return null
  }
}

export const removeLocal = (key: string): void => {
  try {
    storage.delete(key)
  } catch (e) {
    console.error(`Error removing ${key}:`, e)
  }
}

export const clearLocal = (): void => {
  try {
    storage.clearAll()
  } catch (e) {
    console.error('Error clearing storage:', e)
  }
}

export const getAllKeys = (): string[] => {
  try {
    return storage.getAllKeys()
  } catch (e) {
    console.error('Error getting keys:', e)
    return []
  }
}
