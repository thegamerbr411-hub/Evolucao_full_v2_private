import {
  exchangeGoogleAuthCode,
  isGoogleAuthConfigured,
  loginWithGoogleToken,
  logoutGoogleSession,
  useGoogleAuth,
} from './authService.js'

type LegacyGoogleAuthResponse = {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    avatar?: string
  }
}

export const loginWithGoogle = async (googleIdToken?: string): Promise<LegacyGoogleAuthResponse | null> => {
  const idToken = String(googleIdToken || '').trim()
  if (!idToken) {
    return null
  }

  const user = await loginWithGoogleToken({ idToken, accessToken: null })
  if (!user?.id) {
    return null
  }

  return {
    accessToken: '',
    refreshToken: '',
    user: {
      id: String(user.id),
      email: String(user.email || ''),
      name: String(user.name || 'Usuario'),
      avatar: undefined,
    },
  }
}

export const logout = async () => {
  await logoutGoogleSession()
}

export {
  exchangeGoogleAuthCode,
  isGoogleAuthConfigured,
  loginWithGoogleToken,
  logoutGoogleSession,
  useGoogleAuth,
}
