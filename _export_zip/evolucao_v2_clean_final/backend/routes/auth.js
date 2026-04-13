// backend/routes/auth.js
import express from 'express'
import { generateToken, authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Mock database (em produção seria real DB)
let users = [
  {
    id: '1',
    email: 'teste@evolucao.app',
    name: 'Felipe',
    xp: 0,
  },
]

/**
 * POST /auth/google
 * Google login → validar token → retornar JWT
 */
router.post('/google', (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Token required' })
    }

    // ⚠️ Em produção você validaria com Google API aqui
    // const googleUser = await verifyGoogleToken(token)

    // Mock: simular validação
    const user = {
      id: Math.random().toString(36).substr(2, 9),
      email: `user-${Date.now()}@evolucao.app`,
      name: 'Usuário Novo',
      xp: 0,
    }

    users.push(user)

    const accessToken = generateToken(user)

    res.json({
      accessToken,
      refreshToken: 'refresh-token-aqui', // em produção seria diferente
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /auth/refresh
 * Refresh token automático
 */
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body

    // Mock - em produção validaria refresh token
    const user = users[0]

    const accessToken = generateToken(user)

    res.json({
      accessToken,
      refreshToken,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /auth/me
 * Informações do usuário logado
 */
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = users.find((u) => u.id === req.user.id)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /auth/logout
 */
router.post('/logout', authMiddleware, (req, res) => {
  // Em produção você blacklistaria o token
  res.json({ ok: true })
})

export default router
