import { NextResponse } from 'next/server'
import { getSession } from '../../../../lib/auth'
import { sql } from '../../../../lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null })
  const rows = await sql`SELECT id, email, full_name, role, active FROM users WHERE id=${session.id} LIMIT 1`
  const user = rows[0]
  if (!user || !user.active) return NextResponse.json({ user: null })
  return NextResponse.json({ user })
}
