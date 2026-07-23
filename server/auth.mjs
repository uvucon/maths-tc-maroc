import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'fallback_secret'

export function useAuth(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.substring(7)
  try {
    return jwt.verify(token, SECRET)
  } catch (err) {
    return null
  }
}

export function requireAuth(req, res, next) {
  const user = useAuth(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  next()
}
