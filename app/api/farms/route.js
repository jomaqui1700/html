import { NextResponse } from 'next/server'
import { sql } from '../../../lib/db'
import { getSession } from '../../../lib/auth'

async function requireUser() {
  const session = await getSession()
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  return { session }
}

export async function GET() {
  const auth = await requireUser()
  if (auth.error) return auth.error
  const farms = await sql`SELECT id, name, active, created_at FROM farms ORDER BY active DESC, name`
  return NextResponse.json({ farms })
}

export async function POST(request) {
  const auth = await requireUser()
  if (auth.error) return auth.error
  if (auth.session.role !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede crear fincas.' }, { status: 403 })
  try {
    const { name } = await request.json()
    const cleanName = String(name || '').trim()
    if (!cleanName) return NextResponse.json({ error: 'El nombre de la finca es requerido.' }, { status: 400 })
    const rows = await sql`INSERT INTO farms (name, active) VALUES (${cleanName}, true) RETURNING id, name, active, created_at`
    return NextResponse.json({ farm: rows[0] }, { status: 201 })
  } catch (error) {
    if (error?.code === '23505') return NextResponse.json({ error: 'Ya existe una finca con ese nombre.' }, { status: 409 })
    console.error('Create farm error', error)
    return NextResponse.json({ error: 'No se pudo crear la finca.' }, { status: 500 })
  }
}

export async function PATCH(request) {
  const auth = await requireUser()
  if (auth.error) return auth.error
  if (auth.session.role !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede modificar fincas.' }, { status: 403 })
  try {
    const { id, name, active } = await request.json()
    if (!id) return NextResponse.json({ error: 'Finca no válida.' }, { status: 400 })
    const cleanName = String(name || '').trim()
    if (!cleanName) return NextResponse.json({ error: 'El nombre de la finca es requerido.' }, { status: 400 })
    const rows = await sql`UPDATE farms SET name=${cleanName}, active=${Boolean(active)} WHERE id=${id} RETURNING id, name, active, created_at`
    if (!rows[0]) return NextResponse.json({ error: 'Finca no encontrada.' }, { status: 404 })
    return NextResponse.json({ farm: rows[0] })
  } catch (error) {
    if (error?.code === '23505') return NextResponse.json({ error: 'Ya existe una finca con ese nombre.' }, { status: 409 })
    console.error('Update farm error', error)
    return NextResponse.json({ error: 'No se pudo actualizar la finca.' }, { status: 500 })
  }
}
