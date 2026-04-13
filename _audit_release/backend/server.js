// backend/server.js
import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import authRoutes from './routes/auth.js'
import workoutRoutes from './routes/workouts.js'
import syncRoutes from './routes/sync.js'
import socialRoutes from './routes/social.js'
import rankingRoutes from './routes/ranking.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Logger simples
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// Routes
app.use('/auth', authRoutes)
app.use('/workouts', workoutRoutes)
app.use('/sync', syncRoutes)
app.use('/social', socialRoutes)
app.use('/ranking', rankingRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
})
