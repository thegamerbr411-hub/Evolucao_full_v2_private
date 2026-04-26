// backend/routes/workouts.js
import express from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Armazenamento em memória — dados se perdem ao reiniciar o servidor (MVP/beta)
const workoutStore = []

/**
 * POST /workouts
 * Salvar sessão de treino completa (formato enviado pelo cliente workoutApiService.js)
 * Aceita tanto o formato legado { exercise, weight, reps, sets }
 * quanto o formato novo { exercises: [...], totalVolume, xp }
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    // Formato novo: payload com array de exercises
    if (req.body.exercises && Array.isArray(req.body.exercises)) {
      const { exercises, userId: bodyUserId, plan, totalVolume, xp: xpSuggested, date, sessionId } = req.body
      if (!exercises.length) {
        return res.status(400).json({ error: 'exercises array is empty' })
      }
      const volume = Number(totalVolume || exercises.reduce((acc, e) => {
        const sets = Array.isArray(e.sets) ? e.sets : []
        return acc + sets.reduce((s, set) => s + Number(set.weight || 0) * Number(set.reps || 0), 0)
      }, 0))
      const xp = Number(xpSuggested || Math.round(volume * 0.1))
      const session = {
        id: sessionId || Math.random().toString(36).substr(2, 9),
        userId: req.user.id,
        plan: plan || 'free',
        exercises,
        totalVolume: volume,
        xp,
        date: date || new Date().toISOString(),
        createdAt: Date.now(),
      }
      workoutStore.push(session)
      return res.json({ ok: true, success: true, workout: session, xp })
    }

    // Formato legado: { exercise, weight, reps, sets }
    const { exercise, weight, reps, sets, rpe, notes } = req.body
    if (!exercise) {
      return res.status(400).json({ error: 'Exercise required' })
    }
    const workout = {
      id: Math.random().toString(36).substr(2, 9),
      userId: req.user.id,
      exercise,
      weight,
      reps,
      sets,
      rpe,
      notes,
      date: new Date().toISOString(),
      createdAt: Date.now(),
    }
    workoutStore.push(workout)
    const volume = (weight || 0) * (reps || 0) * (sets || 0)
    const xp = Math.round(volume * 0.1)
    return res.json({ ok: true, success: true, workout, xp })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /workouts
 * Listar treinos do usuário
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const { limit = 30, userId: qUserId } = req.query
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 30))
    const filterUserId = qUserId || req.user.id
    // Se usuário solicitou seus próprios dados ou é admin
    const allowed = filterUserId === req.user.id || req.user.isAdmin
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const userWorkouts = workoutStore.filter((w) => w.userId === filterUserId).slice(-safeLimit)
    res.json({
      ok: true,
      workouts: userWorkouts,
      total: userWorkouts.length,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /workouts/:id
 * Detalhes de um treino
 */
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const workout = workoutStore.find((w) => w.id === req.params.id && w.userId === req.user.id)

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' })
    }

    res.json({ workout })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /workouts/:id
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const index = workouts.findIndex(
      (w) => w.id === req.params.id && w.userId === req.user.id
    )

    if (index === -1) {
      return res.status(404).json({ error: 'Workout not found' })
    }

    workouts.splice(index, 1)

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
