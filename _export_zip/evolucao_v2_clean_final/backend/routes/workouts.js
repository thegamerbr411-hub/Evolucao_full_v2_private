// backend/routes/workouts.js
import express from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Mock database
let workouts = []

/**
 * POST /workouts
 * Salvar novo treino
 */
router.post('/', authMiddleware, (req, res) => {
  try {
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

    workouts.push(workout)

    // ✨ Calcular XP automático
    const volume = (weight || 0) * (reps || 0) * (sets || 0)
    const xp = Math.round(volume * 0.1)

    res.json({
      success: true,
      workout,
      xp,
    })
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
    const userWorkouts = workouts.filter((w) => w.userId === req.user.id)

    res.json({
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
    const workout = workouts.find((w) => w.id === req.params.id && w.userId === req.user.id)

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
