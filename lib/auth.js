import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'gsr_session'

function secret() {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET no configurado')
  return new TextEncoder().encode(process.env.AUTH_SECRET)
}

export async function createSession(user) {
  const token = await new SignJWT({ role: user.role, email: user.email, name: user.full_name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret())
  const store = await cookies()
  store.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 })
}

export async function destroySession() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function getSession() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return { id: payload.sub, role: payload.role, email: payload.email, full_name: payload.name }
  } catch {
    return null
  }
}
