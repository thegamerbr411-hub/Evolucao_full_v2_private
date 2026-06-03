// src/services/api.ts
import axios, { AxiosError, AxiosResponse } from 'axios'
import { secureGetItemAsync, secureSetItemAsync } from './secureStorage'
import { useAuthStore } from '../stores/useAuthStore'
import {
  trackNetworkRequestEnd,
  trackNetworkRequestFailure,
  trackNetworkRequestRetry,
  trackNetworkRequestStart,
} from '../runtime_sync/networkActivityManager'

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

const SECURE_READ_TIMEOUT_MS = 2500

async function secureGetItemWithTimeout(key: string): Promise<string | null> {
  return Promise.race([
    secureGetItemAsync(key),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), SECURE_READ_TIMEOUT_MS)
    }),
  ])
}

// 🔑 Interceptor - ADD TOKEN
api.interceptors.request.use(async (config) => {
  const requestId = trackNetworkRequestStart({
    method: config.method,
    url: `${config.baseURL || ''}${config.url || ''}`,
  })

  ;(config as any).__qaRequestId = requestId

  try {
    const token = await secureGetItemWithTimeout('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Interceptor de request
    const method = String(config.method || 'get').toUpperCase()
    const target = `${config.baseURL || ''}${config.url || ''}`
    if (__DEV__) console.log('[API][REQUEST]', method, target)
  } catch (e) {
    console.error('Error getting token:', e)
  }
  return config
})

// 🔄 Interceptor - REFRESH TOKEN automático
api.interceptors.response.use(
  (response) => {
    const requestId = (response.config as any)?.__qaRequestId
    if (requestId) {
      trackNetworkRequestEnd(requestId)
    }

    if (__DEV__) {
      const method = String(response.config?.method || 'get').toUpperCase()
      const target = `${response.config?.baseURL || ''}${response.config?.url || ''}`
      console.log('[API][RESPONSE]', method, target, response.status)
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any
    const requestId = originalRequest?.__qaRequestId

    const status = Number(error.response?.status || 0)
    if (__DEV__) {
      const method = String(originalRequest?.method || '').toUpperCase()
      const url = `${originalRequest?.baseURL || ''}${originalRequest?.url || ''}`
      console.warn('[API][ERROR]', method, url, status)
      // Para rotas de auth (login/cadastro/recupera/google/refresh), logar body de erro
      // completo a fim de diagnosticar invalid_audience / malformed_token / unauthorized_client
      // sem mascaramento. Network-logging cirurgico, sem libs novas.
      if (/\/auth\b/.test(String(originalRequest?.url || ''))) {
        try {
          const dataPreview = JSON.stringify(error.response?.data ?? null)
          console.warn('[API][AUTH_ERROR_BODY]', JSON.stringify({
            url,
            status,
            data: dataPreview && dataPreview.length > 2000 ? dataPreview.slice(0, 2000) + '…' : dataPreview,
            code: String(error?.code || ''),
            message: String(error?.message || ''),
          }))
        } catch {}
      }
    }

    if (status >= 500 && requestId) {
      trackNetworkRequestRetry(requestId)
    }

    // Se erro 401 e não tentou refresh ainda
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = await secureGetItemAsync('refreshToken')

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
        await secureSetItemAsync('accessToken', accessToken)
        if (newRefreshToken) {
          await secureSetItemAsync('refreshToken', newRefreshToken)
        }

        // Tenta request original com novo token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        if (requestId) {
          trackNetworkRequestFailure(requestId, refreshError)
        }
        // Refresh falhou, logout
        useAuthStore.getState().logout()
        return Promise.reject(refreshError)
      }
    }

    if (requestId) {
      trackNetworkRequestFailure(requestId, error)
    }

    return Promise.reject(error)
  }
)

export default api
