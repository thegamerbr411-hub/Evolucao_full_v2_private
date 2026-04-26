// src/storage/mmkv.ts
import { createMMKV } from 'react-native-mmkv'

type StorageLike = {
  set: (key: string, value: string) => void;
  getString: (key: string) => string | undefined;
  delete: (key: string) => void;
  clearAll: () => void;
  getAllKeys: () => string[];
};

const memoryFallback = new Map<string, string>();

const buildMemoryStorage = (): StorageLike => ({
  set: (key, value) => {
    memoryFallback.set(String(key), String(value));
  },
  getString: (key) => memoryFallback.get(String(key)),
  delete: (key) => {
    memoryFallback.delete(String(key));
  },
  clearAll: () => {
    memoryFallback.clear();
  },
  getAllKeys: () => Array.from(memoryFallback.keys()),
});

const createStorage = (): StorageLike => {
  try {
    return createMMKV({ id: 'evolucao-app' }) as StorageLike;
  } catch (error) {
    console.warn('[mmkv] fallback para memoria local:', error);
    return buildMemoryStorage();
  }
};

export const storage = createStorage();

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
