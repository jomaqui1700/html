import { neon } from '@neondatabase/serverless'

const connectionString =
  process.env.DATABASE_POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.DATABASE_POSTGRES_URL_NON_POOLING

if (!connectionString) {
  throw new Error('No se encontró la variable de conexión a Neon en Vercel.')
}

export const sql = neon(connectionString)
