// backend/routes/ranking.js
import express from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Mock data - em produção seria calculated/cache
let userRankings = [
  { userId: '1', userName: 'Felipe', xp: 1200, streak: 5, position: 1 },
  { userId: '2', userName: 'João', xp: 950, streak: 3, position: 2 },
  { userId: '3', userName: 'Maria', xp: 800, streak: 7, position: 3 },
]

/**
 * GET /ranking
 * Ranking global
 */
router.get('/', (req, res) => {
  try {
    const ranking = userRankings
      .sort((a, b) => b.xp - a.xp)
      .map((item, index) => ({
        ...item,
        position: index + 1,
      }))

    res.json({ ranking })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /ranking/me
 * Posição do usuário
 */
router.get('/me', authMiddleware, (req, res) => {
  try {
    const ranking = userRankings
      .sort((a, b) => b.xp - a.xp)
      .map((item, index) => ({
        ...item,
        position: index + 1,
      }))

    const userRanking = ranking.find((r) => r.userId === req.user.id)

    if (!userRanking) {
      return res.json({
        position: ranking.length + 1,
        xp: 0,
        streak: 0,
      })
    }

    res.json(userRanking)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /ranking/add-xp
 * Adicionar XP (chamado após salvar treino)
 */
router.post('/add-xp', authMiddleware, (req, res) => {
  try {
    const { xp } = req.body

    if (!xp || xp < 0) {
      return res.status(400).json({ error: 'Valid XP required' })
    }

    let ranking = userRankings.find((r) => r.userId === req.user.id)

    if (!ranking) {
      ranking = {
        userId: req.user.id,
        userName: req.user.name,
        xp: 0,
        streak: 1,
        position: userRankings.length + 1,
      }
      userRankings.push(ranking)
    }

    ranking.xp += xp

    res.json({
      success: true,
      totalXp: ranking.xp,
      gainedXp: xp,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /ranking/weekly
 * Ranking semanal (reset todo domingo)
 */
router.get('/weekly', (req, res) => {
  try {
    // Em produção teria table separado
    const weeklyRanking = userRankings
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        position: index + 1,
      }))

    res.json({ ranking: weeklyRanking })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
