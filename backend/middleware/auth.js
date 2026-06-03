// backend/middleware/auth.js
import jwt from 'jsonwebtoken'

const SECRET = String(process.env.JWT_SECRET || '').trim()
let resolveAuthUser = null

export const setAuthUserResolver = (resolver) => {
  resolveAuthUser = typeof resolver === 'function' ? resolver : null
}

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

    if (resolveAuthUser) {
      const resolvedUser = resolveAuthUser(user)
      if (resolvedUser && resolvedUser.active === false) {
        return res.status(403).json({ error: 'Account blocked', code: 'ACCOUNT_BLOCKED' })
      }

      const revokedAt = Number(resolvedUser?.sessionRevokedAt || 0)
      const tokenIssuedAt = Number(user?.iat || 0) * 1000
      if (revokedAt > 0 && tokenIssuedAt > 0 && tokenIssuedAt < revokedAt) {
        return res.status(401).json({ error: 'Session revoked', code: 'SESSION_REVOKED' })
      }

      if (resolvedUser) {
        req.user = {
          ...user,
          role: resolvedUser?.role || user?.role || 'user',
          isAdmin: Boolean(resolvedUser?.isAdmin || user?.isAdmin),
        }
        return next()
      }
    }

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

  const role = user?.role === 'admin' ? 'admin' : 'user'
  const isAdmin = Boolean(user?.isAdmin || role === 'admin')

  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role, isAdmin },
    SECRET,
    { expiresIn: '7d' }
  )
}
