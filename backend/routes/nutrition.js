import express from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Store em memoria para MVP.
const nutritionStore = []

router.post('/logs', authMiddleware, (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) {
      return res.status(400).json({ error: 'items required' })
    }

    const now = new Date().toISOString()
    const entry = {
      id: Math.random().toString(36).slice(2),
      userId: req.user.id,
      date: String(req.body?.date || now.slice(0, 10)),
      loggedAt: String(req.body?.loggedAt || now),
      items,
      totals: {
        calories: items.reduce((acc, item) => acc + Number(item?.calories || 0), 0),
        protein: items.reduce((acc, item) => acc + Number(item?.protein || 0), 0),
        carbs: items.reduce((acc, item) => acc + Number(item?.carbs || 0), 0),
        fats: items.reduce((acc, item) => acc + Number(item?.fats || 0), 0),
      },
      createdAt: now,
    }

    nutritionStore.push(entry)
    return res.json({ ok: true, entry })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

router.get('/logs', authMiddleware, (req, res) => {
  try {
    const date = String(req.query?.date || '').trim()
    const filtered = nutritionStore.filter((item) => {
      if (item.userId !== req.user.id) return false
      if (!date) return true
      return item.date === date
    })

    return res.json({ ok: true, logs: filtered })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

router.get('/summary', authMiddleware, (req, res) => {
  try {
    const date = String(req.query?.date || '').trim()
    const logs = nutritionStore.filter((item) => {
      if (item.userId !== req.user.id) return false
      if (!date) return true
      return item.date === date
    })

    const summary = logs.reduce((acc, item) => ({
      calories: acc.calories + Number(item?.totals?.calories || 0),
      protein: acc.protein + Number(item?.totals?.protein || 0),
      carbs: acc.carbs + Number(item?.totals?.carbs || 0),
      fats: acc.fats + Number(item?.totals?.fats || 0),
    }), {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
    })

    return res.json({ ok: true, summary, count: logs.length })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
