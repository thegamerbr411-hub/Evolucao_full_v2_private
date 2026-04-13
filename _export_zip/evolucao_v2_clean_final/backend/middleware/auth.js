// backend/middleware/auth.js
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-prod'

export const authMiddleware = (req, res, next) => {
  try {
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
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    SECRET,
    { expiresIn: '7d' }
  )
}
