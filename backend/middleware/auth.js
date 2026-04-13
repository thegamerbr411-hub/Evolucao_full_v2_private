// backend/middleware/auth.js
import jwt from 'jsonwebtoken'

const SECRET = String(process.env.JWT_SECRET || '').trim()

export const authMiddleware = (req, res, next) => {
  try {
    if (!SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' })
    }

    const header = req.headers.authorization

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' })
    }

    const token = header.substring(7)
    const user = jwt.verify(token, SECRET)

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export const generateToken = (user) => {
  if (!SECRET) {
    throw new Error('JWT_SECRET not configured')
  }

  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    SECRET,
    { expiresIn: '7d' }
  )
}
