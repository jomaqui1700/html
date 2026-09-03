import { NextResponse } from 'next/server'
import { sql } from '../../../lib/db'
import { getSession } from '../../../lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const farms = await sql`SELECT id, name, active FROM farms WHERE active = true ORDER BY name`
  return NextResponse.json({ farms })
}
