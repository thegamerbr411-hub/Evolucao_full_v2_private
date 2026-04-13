// src/services/authService.ts
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import api from './api'
import { useAuthStore } from '../stores/useAuthStore'

WebBrowser.maybeCompleteAuthSession()

// ⚠️ MUDE PRA SEU GOOGLE CLIENT ID (Android)
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || ''

type GoogleAuthResponse = {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    avatar?: string
  }
}

export const loginWithGoogle = async (googleIdToken?: string): Promise<GoogleAuthResponse | null> => {
  try {
    if (!googleIdToken) {
      return null
    }

    // 🔄 Envia token Google pro backend
    const response = await api.post('/auth/google', {
      token: googleIdToken,
    })

    const { accessToken, refreshToken, user } = response.data

    // 💾 Salva tokens
    await useAuthStore.getState().setToken(accessToken, refreshToken)

    // 👤 Salva usuário
    useAuthStore.getState().setUser(user)

    return {
      accessToken,
      refreshToken,
      user,
    }
  } catch (error) {
    console.error('Login Google erro:', error)
    return null
  }
}

/**
 * Logout
 */
export const logout = async () => {
  try {
    await api.post('/auth/logout')
  } catch (e) {
    console.error('Logout error:', e)
  }

  await useAuthStore.getState().logout()
}

/**
 * Provider do Google Auth (deve ser usado em App.tsx)
 */
export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_ID, // Android
    expoClientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID, // iPhone
  })

  return { request, response, promptAsync }
}
