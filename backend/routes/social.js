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

/**
 * GET /social/overview
 * Painel social consolidado: ranking, desafios, amigos e leaderboards
 */
router.get('/overview', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id

    const userFriendsIds = friends
      .filter((f) => f.userId === userId)
      .map((f) => f.friendId || f.friendUserId)

    // Ranking de amigos por XP (dados do feed)
    const xpMap = {}
    feedItems.forEach((item) => {
      if (!xpMap[item.userId]) {
        xpMap[item.userId] = { userId: item.userId, username: item.userName || 'Atleta', xp: 0, workoutsCount: 0, totalVolume: 0 }
      }
      xpMap[item.userId].xp += Number(item.xp || 0)
      xpMap[item.userId].workoutsCount += 1
      xpMap[item.userId].totalVolume += Number(item.data?.totalVolume || 0)
    })

    const friendsLeaderboard = Object.values(xpMap)
      .filter((e) => userFriendsIds.includes(e.userId) || e.userId === userId)
      .sort((a, b) => b.xp - a.xp)
      .map((e, idx) => ({ ...e, position: idx + 1, isCurrentUser: e.userId === userId }))

    const completedLeaderboard = Object.values(xpMap)
      .sort((a, b) => b.workoutsCount - a.workoutsCount)
      .map((e, idx) => ({ ...e, position: idx + 1, isCurrentUser: e.userId === userId }))
      .slice(0, 10)

    const volumeLeaderboard = Object.values(xpMap)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .map((e, idx) => ({ ...e, position: idx + 1, isCurrentUser: e.userId === userId }))
      .slice(0, 10)

    const consistencyLeaderboard = completedLeaderboard

    const recentFeed = feedItems
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)

    res.json({
      ok: true,
      data: {
        friendsLeaderboard,
        completedLeaderboard,
        volumeLeaderboard,
        consistencyLeaderboard,
        recentFeed,
        friends: userFriends,
        challenges: [],
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Helper local
const userFriends = friends

/**
 * POST /social/challenges
 * Criar desafio
 */
router.post('/challenges', authMiddleware, (req, res) => {
  try {
    const { title, target = 3, type = 'workouts_count', endDate } = req.body
    if (!title) {
      return res.status(400).json({ error: 'title required' })
    }
    res.json({ ok: true, data: { id: Math.random().toString(36).slice(2), title, target, type, endDate, createdBy: req.user.id, createdAt: new Date().toISOString() } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
