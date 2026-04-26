// backend/routes/subscription.js
import express from 'express'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
const SECRET = String(process.env.JWT_SECRET || '').trim()

const ALLOWED_TYPES = ['trial', 'pro']

// POST /subscription/activate
// Requer JWT de usuario autenticado. Valida o tipo de ativacao e retorna
// um token de confirmacao assinado. O cliente so deve persistir o plano
// localmente apos receber esse token.
router.post('/activate', authMiddleware, (req, res) => {
  try {
    const { type } = req.body

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'type deve ser "trial" ou "pro"' })
    }

    if (!SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' })
    }

    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Usuario nao identificado' })
    }

    const activatedAt = new Date().toISOString()

    const activationToken = jwt.sign(
      { userId, type, activatedAt, iss: 'evolucao-subscription' },
      SECRET,
      { expiresIn: type === 'trial' ? '7d' : '365d' }
    )

    console.log(`[SUBSCRIPTION] ${type} ativado para userId=${userId} em ${activatedAt}`)

    return res.status(200).json({ ok: true, activationToken, type, activatedAt })
  } catch (error) {
    console.error('[SUBSCRIPTION] Erro ao ativar:', error?.message)
    return res.status(500).json({ error: 'Erro interno ao processar ativacao' })
  }
})

// GET /subscription/status
// Retorna o status de assinatura registrado no token do usuario autenticado.
router.get('/status', authMiddleware, (req, res) => {
  const userId = req.user?.id
  return res.status(200).json({ ok: true, userId, plan: 'free' })
})

export default router
