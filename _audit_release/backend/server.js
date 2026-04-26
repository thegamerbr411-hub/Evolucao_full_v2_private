// backend/server.js
import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import authRoutes from './routes/auth.js'
import workoutRoutes from './routes/workouts.js'
import syncRoutes from './routes/sync.js'
import socialRoutes from './routes/social.js'
import rankingRoutes from './routes/ranking.js'
import subscriptionRoutes from './routes/subscription.js'

const app = express()
const PORT = Number(process.env.PORT || 3001)

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
app.use('/subscription', subscriptionRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Start server with graceful fallback when default port is busy.
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
})

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} ocupada. Defina PORT em .env (ex: PORT=3002).`)
    process.exit(1)
    return
  }
  throw error
})
