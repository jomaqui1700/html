import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sql } from '../../../../lib/db'
import { createSession } from '../../../../lib/auth'

export async function POST(request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) return NextResponse.json({ error: 'Correo y contraseña son requeridos.' }, { status: 400 })
    const rows = await sql`SELECT id, email, full_name, role, password_hash, active FROM users WHERE lower(email)=lower(${email}) LIMIT 1`
    const user = rows[0]
    if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 })
    }
    await createSession(user)
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } })
  } catch (error) {
    console.error('Login error', error)
    return NextResponse.json({ error: 'No se pudo iniciar sesión.' }, { status: 500 })
  }
}
