// backend/routes/auth.js
import express from 'express'
import nodemailer from 'nodemailer'
import { generateToken, authMiddleware, setAuthUserResolver } from '../middleware/auth.js'

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

const allowedGoogleAudiences = new Set(
  String(process.env.GOOGLE_ALLOWED_AUDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
)

async function validateGoogleIdToken(idToken) {
  const token = String(idToken || '').trim()
  if (!token) {
    return { ok: false, error: 'Token required' }
  }

  const decoded = decodeGoogleTokenPayload(token)
  if (!decoded || !decoded.email || !decoded.sub) {
    return { ok: false, error: 'Invalid Google token payload' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, error: 'Invalid Google token' }
    }

    const tokenInfo = await response.json()
    const audience = String(tokenInfo?.aud || '')
    const email = String(tokenInfo?.email || decoded.email || '').trim().toLowerCase()
    const emailVerified = String(tokenInfo?.email_verified || '').toLowerCase() === 'true'
    const issuer = String(tokenInfo?.iss || '')

    const validIssuer = issuer === 'https://accounts.google.com' || issuer === 'accounts.google.com'
    
    if (!validIssuer) {
      console.warn('[OAuth] Invalid issuer:', issuer)
      return { ok: false, error: 'Invalid token issuer' }
    }
    
    if (!emailVerified) {
      console.warn('[OAuth] Email not verified for:', email)
      return { ok: false, error: 'Email must be verified' }
    }
    
    // Optional: validate audience only if configured
    if (allowedGoogleAudiences.size > 0 && !allowedGoogleAudiences.has(audience)) {
      console.warn('[OAuth] Audience not in allowed list:', audience)
      return { ok: false, error: 'Invalid token audience' }
    }
    if (!validIssuer || !email || !emailVerified) {
      return { ok: false, error: 'Invalid Google token claims' }
    }

    if (allowedGoogleAudiences.size > 0 && !allowedGoogleAudiences.has(audience)) {
      return { ok: false, error: 'Google token audience not allowed' }
    }

    return {
      ok: true,
      email,
      name: String(tokenInfo?.name || decoded?.name || 'Usuario Novo'),
      audience,
      subject: String(tokenInfo?.sub || decoded?.sub || ''),
    }
  } catch {
    return { ok: false, error: 'Google token validation failed' }
  } finally {
    clearTimeout(timeout)
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

function sanitizeAdminUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'user',
    isAdmin: Boolean(user.isAdmin),
    active: user.active !== false,
    blockedReason: user.blockedReason || null,
    blockedAt: user.blockedAt || null,
    sessionRevokedAt: user.sessionRevokedAt || 0,
  }
}

function requireAdmin(req, res, next) {
  if (!Boolean(req?.user?.isAdmin || req?.user?.role === 'admin')) {
    return res.status(403).json({ error: 'Admin only' })
  }
  return next()
}

function ensureAccountActive(user, res) {
  if (user && user.active === false) {
    res.status(403).json({ error: 'Conta bloqueada. Contate o administrador.', code: 'ACCOUNT_BLOCKED' })
    return false
  }
  return true
}

setAuthUserResolver((claims = {}) => {
  const byId = findUserById(claims?.id)
  if (byId) return byId
  return findUserByEmail(claims?.email)
})

// Manter compatibilidade com código legado que usava array
const users = { find: (fn) => [...userStore.values()].find(fn) }

// Armazenamento temporário de códigos de verificação (TTL: 15 min)
const pendingCodes = new Map()
const pendingResetTokens = new Map()

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    auth: { user, pass },
  })
}

async function sendWithResend({ email, subject, text, html }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  const configuredFrom = String(process.env.RESEND_FROM || process.env.SMTP_FROM || '').trim()
  const fallbackFrom = 'onboarding@resend.dev'
  const primaryFrom = configuredFrom || fallbackFrom
  if (!apiKey) return false

  const sendRequest = async (fromAddress) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject,
          text,
          html,
        }),
        signal: controller.signal,
      })
      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  try {
    // Retry logic: primary from address with up to 2 attempts
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        let response = await sendRequest(primaryFrom)
        if (response.ok) return true

        const shouldRetryWithOnboarding =
          response.status === 403 && primaryFrom.toLowerCase() !== fallbackFrom

        if (shouldRetryWithOnboarding) {
          console.warn('[email] Resend denied sender domain, retrying with onboarding@resend.dev')
          response = await sendRequest(fallbackFrom)
          if (response.ok) return true
        }

        if (attempt < 2) {
          console.warn(`[email] Resend attempt ${attempt} failed with status ${response.status}, retrying...`)
          await new Promise(r => setTimeout(r, 500))
        }
      } catch (attemptErr) {
        console.warn(`[email] Resend attempt ${attempt} error: ${attemptErr.message}`)
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 500))
        }
      }
    }
    return false
  } catch (err) {
    console.warn('[email] Resend fatal error:', err.message)
    return false
  }
}

async function sendEmail({ email, subject, text, html }) {
  const hasResendConfigured = Boolean(String(process.env.RESEND_API_KEY || '').trim())
  
  // Try Resend if configured
  if (hasResendConfigured) {
    const deliveredByResend = await sendWithResend({ email, subject, text, html })
    if (deliveredByResend) {
      return true
    }
    console.warn('[email] Resend unavailable, attempting SMTP fallback')
  }

  // Fallback to SMTP
  const transporter = createSmtpTransporter()
  if (!transporter) {
    console.warn('[email] Neither Resend nor SMTP configured')
    return false
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject,
      text,
      html,
    })
    console.log('[email] Delivered via SMTP to', email)
    return true
  } catch (err) {
    console.warn('[email] SMTP failed:', err.message)
    return false
  }
}

/**
 * POST /auth/send-code
 * Gera código de 6 dígitos e envia por e-mail (Resend ou SMTP),
 * senão retorna o código na resposta (modo dev/offline).
 */
router.post('/send-code', async (req, res) => {
  try {
    const { email } = req.body
    const safeEmail = String(email || '').trim().toLowerCase()
    if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return res.status(400).json({ error: 'E-mail inválido.' })
    }

    const existingUser = findUserByEmail(safeEmail)
    if (existingUser && existingUser.active === false) {
      return res.status(403).json({ error: 'Conta bloqueada. Contate o administrador.', code: 'ACCOUNT_BLOCKED' })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = Date.now() + 15 * 60 * 1000 // 15 min
    pendingCodes.set(safeEmail, { code, expiresAt })

    const delivered = await sendEmail({
      email: safeEmail,
      subject: 'Seu código de verificação — Evolução App',
      text: `Seu código de verificação é: ${code}\n\nEle expira em 15 minutos.\n\nSe não foi você, ignore este e-mail.`,
      html: `<h2>Código de verificação</h2><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p><p>Expira em 15 minutos.</p>`,
    })
    if (delivered) {
      return res.json({ ok: true, delivery: 'email' })
    }

    // Sem SMTP configurado: retorna o código na resposta (dev/local)
    return res.json({ ok: true, delivery: 'local', code })
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao enviar código. Tente novamente.' })
  }
})

/**
 * POST /auth/forgot-password
 * Envia link/token de recuperação por e-mail.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    const safeEmail = String(email || '').trim().toLowerCase()
    if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return res.status(400).json({ error: 'E-mail inválido.' })
    }

    const existingUser = findUserByEmail(safeEmail)
    if (existingUser && existingUser.active === false) {
      return res.status(403).json({ error: 'Conta bloqueada. Contate o administrador.', code: 'ACCOUNT_BLOCKED' })
    }

    const resetToken = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    const expiresAt = Date.now() + 30 * 60 * 1000
    pendingResetTokens.set(safeEmail, { token: resetToken, expiresAt })

    const resetBaseUrl = String(process.env.PASSWORD_RESET_URL || process.env.FRONTEND_URL || '').trim()
    const resetLink = resetBaseUrl
      ? `${resetBaseUrl.replace(/\/+$/, '')}?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(safeEmail)}`
      : `Token de recuperação: ${resetToken}`

    const delivered = await sendEmail({
      email: safeEmail,
      subject: 'Recuperação de senha — Evolução App',
      text: `Você solicitou recuperação de senha.\n\n${resetLink}\n\nExpira em 30 minutos. Se não foi você, ignore este e-mail.`,
      html: `<h2>Recuperação de senha</h2><p>Use o link abaixo para redefinir sua senha:</p><p><a href="${String(resetLink).replace(/"/g, '&quot;')}">${resetLink}</a></p><p>Expira em 30 minutos.</p>`,
    })

    if (!delivered) {
      return res.status(503).json({ error: 'Servico de e-mail indisponivel no momento.' })
    }

    return res.json({ ok: true, delivery: 'email' })
  } catch {
    return res.status(500).json({ error: 'Falha ao processar recuperação de senha.' })
  }
})

/**
 * POST /auth/reset-password
 * Consome token de recuperação e define nova senha (MVP/in-memory).
 */
router.post('/reset-password', (req, res) => {
  try {
    const { email, token, newPassword } = req.body
    const safeEmail = String(email || '').trim().toLowerCase()
    const safeToken = String(token || '').trim()
    const safePassword = String(newPassword || '').trim()

    if (!safeEmail || !safeToken || safePassword.length < 6) {
      return res.status(400).json({ error: 'Dados inválidos para redefinição.' })
    }

    const entry = pendingResetTokens.get(safeEmail)
    if (!entry || entry.token !== safeToken) {
      return res.status(400).json({ error: 'Token inválido ou já utilizado.' })
    }

    if (Date.now() > entry.expiresAt) {
      pendingResetTokens.delete(safeEmail)
      return res.status(400).json({ error: 'Token expirado. Solicite novamente.' })
    }

    let user = findUserByEmail(safeEmail)
    if (!user) {
      user = {
        id: Math.random().toString(36).substr(2, 9),
        email: safeEmail,
        name: 'Usuario',
        role: resolveRoleByEmail(safeEmail),
        isAdmin: resolveRoleByEmail(safeEmail) === 'admin',
        xp: 0,
        active: true,
        blockedReason: null,
        blockedAt: null,
        sessionRevokedAt: 0,
      }
    }

    if (!ensureAccountActive(user, res)) {
      return
    }

    user.password = safePassword
    upsertUser(user)
    pendingResetTokens.delete(safeEmail)
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Falha ao redefinir senha.' })
  }
})

/**
 * POST /auth/login-password
 * Login simples por e-mail/senha (MVP/in-memory).
 */
router.post('/login-password', (req, res) => {
  try {
    const { email, password } = req.body
    const safeEmail = String(email || '').trim().toLowerCase()
    const safePassword = String(password || '').trim()

    if (!safeEmail || !safePassword) {
      return res.status(400).json({ error: 'Credenciais inválidas.' })
    }

    const user = findUserByEmail(safeEmail)
    if (!user || String(user.password || '') !== safePassword) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' })
    }

    if (!ensureAccountActive(user, res)) {
      return
    }

    const accessToken = generateToken(user)
    return res.json({
      ok: true,
      accessToken,
      refreshToken: 'refresh-token-aqui',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        isAdmin: Boolean(user.isAdmin),
      },
    })
  } catch {
    return res.status(500).json({ error: 'Falha ao fazer login.' })
  }
})

/**
 * POST /auth/verify-code
 * Valida o código informado pelo usuário.
 */
router.post('/verify-code', (req, res) => {
  try {
    const { email, code } = req.body
    const safeEmail = String(email || '').trim().toLowerCase()
    const safeCode = String(code || '').trim()

    const entry = pendingCodes.get(safeEmail)
    if (!entry) {
      return res.status(400).json({ error: 'Código não encontrado ou expirado.' })
    }

    if (Date.now() > entry.expiresAt) {
      pendingCodes.delete(safeEmail)
      return res.status(400).json({ error: 'Código expirado. Solicite um novo.' })
    }

    if (safeCode !== entry.code) {
      return res.status(400).json({ error: 'Código incorreto.' })
    }

    pendingCodes.delete(safeEmail)
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao verificar código.' })
  }
})

/**
 * POST /auth/google
 * Google login → validar token → retornar JWT
 */
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Token required' })
    }

    const validated = await validateGoogleIdToken(token)
    if (!validated.ok) {
      return res.status(401).json({ error: validated.error || 'Invalid Google token' })
    }

    const email = String(validated.email || '').trim().toLowerCase()
    if (!email) {
      return res.status(401).json({ error: 'Invalid Google token email' })
    }

    const role = resolveRoleByEmail(email)

    // Reusar usuário existente pelo email para evitar duplicatas por restart
    const existing = findUserByEmail(email)
    const user = existing || upsertUser({
      id: Math.random().toString(36).substr(2, 9),
      email,
      name: String(validated.name || 'Usuario Novo'),
      role,
      isAdmin: role === 'admin',
      xp: 0,
      active: true,
      blockedReason: null,
      blockedAt: null,
      sessionRevokedAt: 0,
    })

    if (!existing) {
      upsertUser(user)
    }

    if (!ensureAccountActive(user, res)) {
      return
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
        active: user.active !== false,
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

router.get('/admin/users', authMiddleware, requireAdmin, (req, res) => {
  const list = [...userStore.values()]
    .sort((a, b) => String(a?.email || '').localeCompare(String(b?.email || '')))
    .map((item) => sanitizeAdminUser(item))

  return res.json({ ok: true, users: list })
})

router.post('/admin/block', authMiddleware, requireAdmin, (req, res) => {
  const targetUserId = String(req.body?.userId || '').trim()
  const targetEmail = String(req.body?.email || '').trim().toLowerCase()
  const reason = String(req.body?.reason || '').trim() || 'blocked_by_admin'

  const user = targetUserId ? findUserById(targetUserId) : findUserByEmail(targetEmail)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  user.active = false
  user.blockedReason = reason
  user.blockedAt = new Date().toISOString()
  user.sessionRevokedAt = Date.now()
  upsertUser(user)

  return res.json({ ok: true, user: sanitizeAdminUser(user) })
})

router.post('/admin/unblock', authMiddleware, requireAdmin, (req, res) => {
  const targetUserId = String(req.body?.userId || '').trim()
  const targetEmail = String(req.body?.email || '').trim().toLowerCase()

  const user = targetUserId ? findUserById(targetUserId) : findUserByEmail(targetEmail)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  user.active = true
  user.blockedReason = null
  user.blockedAt = null
  upsertUser(user)

  return res.json({ ok: true, user: sanitizeAdminUser(user) })
})

router.post('/admin/revoke-session', authMiddleware, requireAdmin, (req, res) => {
  const targetUserId = String(req.body?.userId || '').trim()
  const targetEmail = String(req.body?.email || '').trim().toLowerCase()

  const user = targetUserId ? findUserById(targetUserId) : findUserByEmail(targetEmail)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  user.sessionRevokedAt = Date.now()
  upsertUser(user)

  return res.json({ ok: true, user: sanitizeAdminUser(user) })
})

export default router
