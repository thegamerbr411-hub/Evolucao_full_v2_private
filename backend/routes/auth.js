// backend/routes/auth.js
import express from 'express'
import nodemailer from 'nodemailer'
import { generateToken, authMiddleware, setAuthUserResolver } from '../middleware/auth.js'

const router = express.Router()

const parseAdminEmails = () => {
  const defaultAdminEmails = [
    'thegamerbr411@gmail.com',
  ]

  const list = [
    ...defaultAdminEmails,
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
  const secureExplicit = String(process.env.SMTP_SECURE || '').trim() === '1'
  const secure = port === 465 || secureExplicit
  const requireTLS = !secure && port === 587 && String(process.env.SMTP_REQUIRE_TLS || '1').trim() !== '0'
  const rejectUnauthorized = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '1').trim() !== '0'
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: { user, pass },
    tls: { rejectUnauthorized },
  })
}

function getEmailDeliveryDiagnostics() {
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim()
  const resendFrom = String(process.env.RESEND_FROM || '').trim()
  const smtpHost = String(process.env.SMTP_HOST || '').trim()
  const smtpUser = String(process.env.SMTP_USER || '').trim()
  const smtpPass = String(process.env.SMTP_PASS || '').trim()
  const smtpFrom = String(process.env.SMTP_FROM || '').trim()

  return {
    resendConfigured: Boolean(resendApiKey),
    resendFromConfigured: Boolean(resendFrom),
    smtpConfigured: Boolean(smtpHost && smtpUser && smtpPass),
    smtpFromConfigured: Boolean(smtpFrom || smtpUser),
  }
}

async function readResendErrorBody(response) {
  const raw = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = null
  }
  const name = parsed && typeof parsed.name === 'string' ? parsed.name : null
  const message = parsed && typeof parsed.message === 'string' ? parsed.message : raw.slice(0, 800)
  return { raw: raw.slice(0, 1500), name, message, status: response.status }
}

function isProductionEnv() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production'
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildVerificationEmail(code) {
  const safeCode = escapeHtml(code)
  const subject = 'Seu código de verificação — Evolução'
  const text = [
    'Evolução — código de verificação',
    '',
    `Seu código é: ${code}`,
    '',
    'Este código expira em 15 minutos.',
    'Se você não solicitou este código, ignore este e-mail.',
    '',
    'Tipolt Labs',
  ].join('\n')
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#0f1419;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f1419;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#1a2332;border-radius:12px;padding:32px 28px;">
        <tr><td align="center" style="padding-bottom:8px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0;">Evolução</p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <p style="margin:0;font-size:14px;color:#94a3b8;">Treinos, nutrição e progresso</p>
        </td></tr>
        <tr><td style="padding-bottom:16px;">
          <p style="margin:0;font-size:15px;line-height:1.5;color:#e2e8f0;">Use o código abaixo para confirmar seu acesso ao Evolução.</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 0;background-color:#0f1419;border-radius:8px;">
          <p style="margin:0;font-size:36px;font-weight:700;color:#38bdf8;letter-spacing:4px;font-family:Consolas,Monaco,monospace;">${safeCode}</p>
        </td></tr>
        <tr><td style="padding-top:20px;">
          <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">Este código expira em 15 minutos.</p>
          <p style="margin:0;font-size:13px;color:#64748b;">Se você não solicitou este código, ignore este e-mail.</p>
        </td></tr>
        <tr><td align="center" style="padding-top:28px;border-top:1px solid #334155;">
          <p style="margin:0;font-size:12px;color:#64748b;">Tipolt Labs</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, text, html }
}

/**
 * Resend: use apenas RESEND_FROM (nunca misturar com SMTP_FROM — domínios diferentes).
 * onboarding@resend.dev só pode enviar para o e-mail da conta Resend; em produção não
 * faz retry para onboarding após falha de domínio (evita segundo 403 inútil para OTP).
 */
async function sendWithResend({ email, subject, text, html, trace }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  const configuredFrom = String(process.env.RESEND_FROM || '').trim()
  const fallbackFrom = 'onboarding@resend.dev'
  const primaryFrom = configuredFrom || fallbackFrom
  if (!apiKey) return false

  const sendRequest = async (fromAddress) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const replyTo = String(process.env.RESEND_REPLY_TO || '').trim()
    const payload = {
      from: fromAddress,
      to: [email],
      subject,
      text,
      html,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
      },
    }
    if (replyTo) {
      payload.reply_to = replyTo
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  const logResendFailure = async (label, response) => {
    const body = await readResendErrorBody(response)
    const line = `[email][resend] ${label} status=${body.status} name=${body.name || 'n/a'} message=${body.message}`
    console.error(line)
    if (trace) {
      trace.resendFailures = trace.resendFailures || []
      trace.resendFailures.push({ label, ...body })
    }
  }

  try {
    let response = await sendRequest(primaryFrom)
    if (response.ok) {
      console.log('[email] Delivered via Resend to', email, 'from', primaryFrom)
      return true
    }

    await logResendFailure(`send from=${primaryFrom}`, response)

    const prod = isProductionEnv()
    const usedCustomFrom = Boolean(configuredFrom)
    const canTryOnboardingFallback =
      usedCustomFrom &&
      primaryFrom.toLowerCase() !== fallbackFrom &&
      (response.status === 403 || response.status === 422) &&
      !prod

    if (canTryOnboardingFallback) {
      console.warn('[email][resend] non-production: retrying with onboarding@resend.dev after sender/domain rejection')
      response = await sendRequest(fallbackFrom)
      if (response.ok) {
        console.log('[email] Delivered via Resend (onboarding) to', email)
        return true
      }
      await logResendFailure(`retry from=${fallbackFrom}`, response)
    } else if (usedCustomFrom && !response.ok && prod) {
      console.error(
        '[email][resend] production: no onboarding retry after custom RESEND_FROM failure. ' +
          'Fix: verify domain at resend.com/domains or configure working SMTP_* vars.',
      )
    }

    return false
  } catch (err) {
    console.error('[email][resend] transport error:', err && err.message ? err.message : err)
    if (trace) trace.resendTransportError = String(err && err.message ? err.message : err)
    return false
  }
}

async function sendEmail({ email, subject, text, html, trace }) {
  const hasResendConfigured = Boolean(String(process.env.RESEND_API_KEY || '').trim())

  if (hasResendConfigured) {
    const deliveredByResend = await sendWithResend({ email, subject, text, html, trace })
    if (deliveredByResend) {
      return { ok: true, channel: 'resend' }
    }
    console.warn('[email] Resend did not deliver; attempting SMTP fallback')
  }

  const transporter = createSmtpTransporter()
  if (!transporter) {
    console.warn('[email] SMTP transporter not created (missing SMTP_HOST/SMTP_USER/SMTP_PASS)')
    return { ok: false, channel: null }
  }

  const fromAddr = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim()
  if (!fromAddr) {
    console.error('[email][smtp] SMTP_FROM and SMTP_USER are empty; cannot set From header')
    return { ok: false, channel: 'smtp' }
  }

  try {
    await transporter.sendMail({
      from: fromAddr,
      to: email,
      subject,
      text,
      html,
    })
    console.log('[email] Delivered via SMTP to', email, 'from', fromAddr)
    return { ok: true, channel: 'smtp' }
  } catch (err) {
    const smtpMsg = [
      err && err.message,
      err && err.response,
      err && err.responseCode,
      err && err.command,
    ]
      .filter(Boolean)
      .join(' | ')
    console.error('[email][smtp] sendMail failed:', smtpMsg)
    if (trace) trace.smtpError = smtpMsg
    return { ok: false, channel: 'smtp' }
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

    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production'
    const emailDiagnostics = getEmailDeliveryDiagnostics()
    console.log('[email][send-code] request', {
      production: isProduction,
      resendConfigured: emailDiagnostics.resendConfigured,
      smtpConfigured: emailDiagnostics.smtpConfigured,
    })
    if (isProduction && emailDiagnostics.resendConfigured && !emailDiagnostics.resendFromConfigured) {
      console.error(
        '[email][send-code] RESEND_API_KEY is set but RESEND_FROM is empty. ' +
          'Resend will use onboarding@resend.dev, which only delivers to your Resend account email (not arbitrary users). ' +
          'Set RESEND_FROM to a sender on a verified domain (resend.com/domains) or configure SMTP_*.',
      )
    }

    if (isProduction && !emailDiagnostics.resendConfigured && !emailDiagnostics.smtpConfigured) {
      console.error('[email][send-code] blocked: no email provider configured in production')
      return res.status(503).json({
        ok: false,
        error: 'Servico de e-mail nao configurado no backend.',
        code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      })
    }

    const existingUser = findUserByEmail(safeEmail)
    if (existingUser && existingUser.active === false) {
      return res.status(403).json({ error: 'Conta bloqueada. Contate o administrador.', code: 'ACCOUNT_BLOCKED' })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = Date.now() + 15 * 60 * 1000 // 15 min
    pendingCodes.set(safeEmail, { code, expiresAt })

    const emailTrace = {}
    const verificationEmail = buildVerificationEmail(code)
    const delivered = await sendEmail({
      email: safeEmail,
      subject: verificationEmail.subject,
      text: verificationEmail.text,
      html: verificationEmail.html,
      trace: emailTrace,
    })
    if (delivered.ok) {
      return res.json({ ok: true, delivery: 'email' })
    }

    if (isProduction) {
      console.error('[email][send-code] delivery failed in production', emailDiagnostics, 'trace=', emailTrace)
      return res.status(503).json({
        ok: false,
        error: 'Servico de e-mail indisponivel no momento.',
        code: 'EMAIL_DELIVERY_FAILED',
      })
    }

    // Sem SMTP configurado: retorna o código na resposta (dev/local)
    return res.json({ ok: true, delivery: 'local', code })
  } catch (error) {
    console.error('[email][send-code] unexpected error', error)
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
      trace: {},
    })

    if (!delivered.ok) {
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
    const { email, user, password } = req.body
    const identifier = String(email || user || '').trim().toLowerCase()
    const safePassword = String(password || '').trim()

    if (!identifier || !safePassword) {
      return res.status(400).json({ error: 'Credenciais inválidas.' })
    }

    let authUser = findUserByEmail(identifier)

    // Bootstrap admin de emergência para ambientes sem seed persistente.
    // Permite login com ADMIN_USER ou ADMIN_EMAIL + ADMIN_PASS.
    if (!authUser) {
      const adminUser = String(process.env.ADMIN_USER || '').trim().toLowerCase()
      const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
      const adminPass = String(process.env.ADMIN_PASS || '').trim()
      const adminMatched = Boolean(adminPass) && safePassword === adminPass && (identifier === adminUser || identifier === adminEmail)

      if (adminMatched) {
        authUser = upsertUser({
          id: 'admin-local',
          email: adminEmail || 'admin@local.evolucao',
          name: 'Administrador',
          role: 'admin',
          isAdmin: true,
          password: adminPass,
          xp: 0,
          active: true,
          blockedReason: null,
          blockedAt: null,
          sessionRevokedAt: 0,
        })
      }
    }

    if (!authUser || String(authUser.password || '') !== safePassword) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' })
    }

    if (!ensureAccountActive(authUser, res)) {
      return
    }

    const accessToken = generateToken(authUser)
    return res.json({
      ok: true,
      accessToken,
      refreshToken: 'refresh-token-aqui',
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        role: authUser.role || 'user',
        isAdmin: Boolean(authUser.isAdmin),
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