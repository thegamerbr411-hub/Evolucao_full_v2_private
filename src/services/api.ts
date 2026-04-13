// src/services/api.ts
import axios, { AxiosError, AxiosResponse } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../stores/useAuthStore'

const API_URL = String(
  process.env.EXPO_PUBLIC_API_URL
  || process.env.EXPO_PUBLIC_API_BASE_URL
  || process.env.API_URL
  || 'https://evolucao-api-dou2.onrender.com'
)
  .trim()
  .replace(/\/+$/, '')

export const API_BASE_URL = API_URL

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
})

// 🔑 Interceptor - ADD TOKEN
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Log temporario de integracao externa.
    const method = String(config.method || 'get').toUpperCase()
    const target = `${config.baseURL || ''}${config.url || ''}`
    console.log('[INTEGRATION][API][REQUEST]', method, target)
  } catch (e) {
    console.error('Error getting token:', e)
  }
  return config
})

// 🔄 Interceptor - REFRESH TOKEN automático
api.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || 'get').toUpperCase()
    const target = `${response.config?.baseURL || ''}${response.config?.url || ''}`
    console.log('[INTEGRATION][API][RESPONSE]', method, target, response.status)
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    const method = String(originalRequest?.method || 'get').toUpperCase()
    const target = `${originalRequest?.baseURL || ''}${originalRequest?.url || ''}`
    const status = Number(error.response?.status || 0)
    console.warn('[INTEGRATION][API][ERROR]', method, target, status)

    // Se erro 401 e não tentou refresh ainda
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken')

        if (!refreshToken) {
          // Sem refresh token, logout
          useAuthStore.getState().logout()
          return Promise.reject(error)
        }

        // Tenta refresh
        const res = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        })

        const { accessToken, refreshToken: newRefreshToken } = res.data

        // Salva novo token
        await SecureStore.setItemAsync('accessToken', accessToken)
        if (newRefreshToken) {
          await SecureStore.setItemAsync('refreshToken', newRefreshToken)
        }

        // Tenta request original com novo token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh falhou, logout
        useAuthStore.getState().logout()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
