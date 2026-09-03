import { NextResponse } from 'next/server'
import { sql } from '../../../../lib/db'

export async function GET() {
  try {
    const result = await sql`SELECT current_database() AS database_name, NOW() AS server_time`
    return NextResponse.json({
      ok: true,
      database: result[0]?.database_name || null,
      serverTime: result[0]?.server_time || null
    })
  } catch (error) {
    console.error('Neon health check failed:', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudo conectar con Neon.' },
      { status: 500 }
    )
  }
}
