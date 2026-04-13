// backend/routes/social.js
import express from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Mock data
let feedItems = []
let friends = []

/**
 * GET /social/feed
 * Feed tipo Strava
 */
router.get('/feed', authMiddleware, (req, res) => {
  try {
    // Em produção seria mais complexo - filtrar amigos, etc
    const feed = feedItems
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)

    res.json({ feed })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /social/feed
 * Criar novo item no feed (treino completo, etc)
 */
router.post('/feed', authMiddleware, (req, res) => {
  try {
    const { text, xp, data } = req.body

    const item = {
      id: Math.random().toString(36).substr(2, 9),
      userId: req.user.id,
      userName: req.user.name,
      text,
      xp,
      data,
      createdAt: Date.now(),
    }

    feedItems.push(item)

    res.json({ success: true, item })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /social/friends/add
 * Adicionar amigo
 */
router.post('/friends/add', authMiddleware, (req, res) => {
  try {
    const { friendId } = req.body

    if (!friendId) {
      return res.status(400).json({ error: 'FriendId required' })
    }

    const friendship = {
      id: Math.random().toString(36).substr(2, 9),
      userId: req.user.id,
      friendId,
      createdAt: Date.now(),
    }

    friends.push(friendship)

    res.json({ success: true, friendship })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /social/friends
 * Listar amigos
 */
router.get('/friends', authMiddleware, (req, res) => {
  try {
    const userFriends = friends.filter((f) => f.userId === req.user.id)

    res.json({ friends: userFriends })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
