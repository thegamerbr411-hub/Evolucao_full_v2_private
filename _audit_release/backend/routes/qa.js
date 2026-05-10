import express from 'express'

const router = express.Router()

router.get('/health', (_req, res) => {
  res.json({ ok: true, module: 'qa', timestamp: new Date().toISOString() })
})

router.post('/events', (req, res) => {
  const payload = req.body || {}
  res.json({ ok: true, accepted: true, eventType: String(payload?.type || 'unknown') })
})

export default router
