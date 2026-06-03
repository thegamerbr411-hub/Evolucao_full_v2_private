// backend/server.js
import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import authRoutes, { VERIFICATION_EMAIL_TEMPLATE_VERSION } from './routes/auth.js'
import workoutRoutes from './routes/workouts.js'
import syncRoutes from './routes/sync.js'
import socialRoutes from './routes/social.js'
import rankingRoutes from './routes/ranking.js'
import subscriptionRoutes from './routes/subscription.js'
import nutritionRoutes from './routes/nutrition.js'
import qaRoutes from './routes/qa.js'

const app = express()
const PORT = Number(process.env.PORT || 3001)
const ENABLE_QA_ENDPOINTS = String(process.env.ENABLE_QA_ENDPOINTS || '').trim() === '1'

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
app.use('/api/auth', authRoutes)
app.use('/workouts', workoutRoutes)
app.use('/api/workouts', workoutRoutes)
app.use('/nutrition', nutritionRoutes)
app.use('/api/nutrition', nutritionRoutes)
app.use('/sync', syncRoutes)
app.use('/api/sync', syncRoutes)
app.use('/social', socialRoutes)
app.use('/api/social', socialRoutes)
app.use('/ranking', rankingRoutes)
app.use('/api/ranking', rankingRoutes)
app.use('/subscription', subscriptionRoutes)
app.use('/api/subscription', subscriptionRoutes)
if (ENABLE_QA_ENDPOINTS) {
  app.use('/qa', qaRoutes)
  app.use('/api/qa', qaRoutes)
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'evolucao-backend',
    renderService: 'evolucao-api-dou2',
    emailTemplateVersion: VERIFICATION_EMAIL_TEMPLATE_VERSION,
    authSendCodeRouteFile: 'backend/routes/auth.js',
    routes: {
      auth: '/auth/*',
      workouts: '/workouts/*',
      nutrition: '/nutrition/*',
      sync: '/sync/*',
    },
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'evolucao-backend',
    renderService: 'evolucao-api-dou2',
    emailTemplateVersion: VERIFICATION_EMAIL_TEMPLATE_VERSION,
    authSendCodeRouteFile: 'backend/routes/auth.js',
    routes: {
      auth: '/auth/* e /api/auth/*',
      workouts: '/workouts/* e /api/workouts/*',
      nutrition: '/nutrition/* e /api/nutrition/*',
      sync: '/sync/* e /api/sync/*',
    },
    timestamp: new Date().toISOString(),
  })
})

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Start server with graceful fallback when default port is busy.
const server = app.listen(PORT, () => {
  console.log(
    '[boot] service=evolucao-api-dou2 email_template_version=%s route_file=backend/routes/auth.js port=%s',
    VERIFICATION_EMAIL_TEMPLATE_VERSION,
    PORT,
  )
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} ocupada. Defina PORT em .env (ex: PORT=3002).`)
    process.exit(1)
    return
  }
  throw error
})
