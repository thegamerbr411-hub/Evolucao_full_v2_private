// src/stores/useAuthStore.ts
import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

export type User = {
  id: string
  email: string
  name: string
  avatar?: string
}

type AuthStore = {
  user: User | null
  isLogged: boolean
  isLoading: boolean

  // Actions
  setUser: (user: User) => void
  setToken: (accessToken: string, refreshToken: string) => Promise<void>
  getToken: () => Promise<string | null>
  logout: () => Promise<void>
  hydrateAuth: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLogged: false,
  isLoading: true,

  setUser: (user) => {
    set({ user, isLogged: true })
  },

  setToken: async (accessToken, refreshToken) => {
    try {
      await SecureStore.setItemAsync('accessToken', accessToken)
      await SecureStore.setItemAsync('refreshToken', refreshToken)
    } catch (e) {
      console.error('Error saving tokens:', e)
    }
  },

  getToken: async () => {
    try {
      return await SecureStore.getItemAsync('accessToken')
    } catch (e) {
      console.error('Error getting token:', e)
      return null
    }
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('accessToken')
      await SecureStore.deleteItemAsync('refreshToken')
      set({ user: null, isLogged: false })
    } catch (e) {
      console.error('Error logging out:', e)
    }
  },

  hydrateAuth: async () => {
    set({ isLoading: true })
    try {
      const token = await get().getToken()
      if (token) {
        // Aqui você pode validar o token com o backend
        // await api.get('/auth/me')
        set({ isLoading: false })
        return
      }
    } catch (e) {
      console.error('Error hydrating auth:', e)
    }
    set({ isLoading: false })
  },
}))
