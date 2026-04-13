// backend/routes/sync.js
import express from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

/**
 * POST /sync
 * Sincronizar dados locais com backend
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const item = req.body

    if (!item.type) {
      return res.status(400).json({ error: 'Type required' })
    }

    // Aqui você processaria o item baseado no tipo
    // Por agora só retorna sucesso

    console.log(`📡 Sync ${item.type} from ${req.user.id}`)

    res.json({
      ok: true,
      message: 'Sync recebido',
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
