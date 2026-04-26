// src/hooks/useAuth.ts
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { loginWithGoogle, logout, useGoogleAuth } from '../services/authService'

export const useAuth = () => {
  const { user, isLogged, isLoading, hydrateAuth, setUser, setToken } = useAuthStore()
  const { promptAsync } = useGoogleAuth()
  const [error, setError] = useState<string | null>(null)

  // 🔄 Hidrata auth na primeira vez
  useEffect(() => {
    hydrateAuth()
  }, [])

  const handleLogin = async () => {
    try {
      setError(null)
      const authResponse = await promptAsync()
      const idToken = authResponse?.type === 'success'
        ? (authResponse.authentication?.idToken || (authResponse as any)?.params?.id_token)
        : null
      const result = await loginWithGoogle(idToken || undefined)

      if (!result) {
        setError('Falha no login')
        return false
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(message)
      return false
    }
  }

  const handleLogout = async () => {
    try {
      setError(null)
      await logout()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no logout'
      setError(message)
      return false
    }
  }

  return {
    user,
    isLogged,
    isLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
  }
}
