import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { env } from './env.js'

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export const db = new Pool({
  connectionString: env.DATABASE_URL,
})
