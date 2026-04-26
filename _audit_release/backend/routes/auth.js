// backend/routes/auth.js
import express from 'express'
import { generateToken, authMiddleware } from '../middleware/auth.js'

const router = express.Router()

const parseAdminEmails = () => {
  const list = [
    String(process.env.ADMIN_EMAILS || ''),
    String(process.env.ADMIN_EMAIL || ''),
  ]
    .join(',')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  return new Set(list)
}

const adminEmails = parseAdminEmails()

const resolveRoleByEmail = (email = '') => {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return 'user'
  return adminEmails.has(normalized) ? 'admin' : 'user'
}

const decodeGoogleTokenPayload = (token = '') => {
  try {
    const [, payload] = String(token || '').split('.')
    if (!payload) {
      return null
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = Buffer.from(normalized, 'base64').toString('utf8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

// Armazenamento em memória — aceita para MVP/beta.
// Em produção: substituir por banco de dados persistente (PostgreSQL, Firestore, etc).
// Dados se perdem a cada restart do servidor. Usuários precisam refazer login.
const userStore = new Map()

// Helpers para isolar acesso
function findUserByEmail(email) {
  for (const u of userStore.values()) {
    if (u.email === email) return u
  }
  return null
}

function findUserById(id) {
  return userStore.get(String(id)) || null
}

function upsertUser(user) {
  userStore.set(String(user.id), user)
  return user
}

// Manter compatibilidade com código legado que usava array
const users = { find: (fn) => [...userStore.values()].find(fn) }

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

    // ⚠️ Em produção você validaria com Google API aqui.
    // Nesta versão usamos decode local para obter email/nome sem bloquear o fluxo QA.
    const decoded = decodeGoogleTokenPayload(token)
    const email = String(decoded?.email || `user-${Date.now()}@evolucao.app`)
    const role = resolveRoleByEmail(email)

    // Reusar usuário existente pelo email para evitar duplicatas por restart
    const existing = findUserByEmail(email)
    const user = existing || upsertUser({
      id: Math.random().toString(36).substr(2, 9),
      email,
      name: String(decoded?.name || 'Usuario Novo'),
      role,
      isAdmin: role === 'admin',
      xp: 0,
    })

    if (!existing) {
      upsertUser(user)
    }

    const accessToken = generateToken(user)

    res.json({
      ok: true,
      accessToken,
      refreshToken: 'refresh-token-aqui', // em produção seria diferente
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
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

    // Mock - em produção validaria refresh token com base de dados
    const user = findUserById(req.user?.id) || { id: req.user?.id, email: req.user?.email, name: req.user?.name, role: req.user?.role || 'user', isAdmin: Boolean(req.user?.isAdmin) }

    const accessToken = generateToken(user)

    res.json({
      ok: true,
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
    const user = findUserById(req.user.id)

    if (!user) {
      // Usuário não encontrado na sessão atual (reinício do servidor)
      // Retornar dados do JWT como fallback para evitar quebrar o cliente
      return res.json({
        ok: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name || 'Usuario',
          role: req.user.role || 'user',
          isAdmin: Boolean(req.user.isAdmin),
        },
      })
    }

    res.json({
      ok: true,
      user: {
        ...user,
        role: user?.role || req.user.role || 'user',
        isAdmin: Boolean(user?.isAdmin || req.user.isAdmin),
      },
    })
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
