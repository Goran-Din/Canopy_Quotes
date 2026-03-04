import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import path from 'path'
import authRoutes from './modules/auth/auth.routes.js'
import customerRoutes from './modules/customers/customer.routes.js'
import {
  propertyNestedRoutes,
  propertyFlatRoutes,
} from './modules/properties/property.routes.js'
import { createServiceRoutes, createPricingRuleRoutes } from './modules/services/service.routes.js'
import { createPdfRoutes } from './modules/pdf/pdf.routes.js'
import { createEmailRoutes } from './modules/email/email.routes.js'
import { createDashboardRoutes } from './modules/dashboard/dashboard.routes.js'
import { createCustomerRoutes } from './modules/dashboard/customer.routes.js'
import userRoutes from './modules/users/user.routes.js'
import { scheduleExpireQuotesJob } from './jobs/expireQuotesJob.js'
import { db } from './config/database.js'
import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const redis = createClient({ url: redisUrl })
redis.on('error', (err) => console.error('[Redis] Client error:', err))
redis.connect().catch((err) => console.error('[Redis] Connection failed (non-fatal):', err))
import quoteRoutes from './modules/quotes/quote.routes.js'
import { errorHandler } from './middleware/error-handler.js'

const app = express()

// Security & parsing middleware
app.use(helmet())
app.use(cors({
  origin: [
    process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    'https://staging-quotes.sunsetapp.us',
  ],
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cookieParser())

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Auth routes (public)
app.use('/v1/auth', authRoutes)

// User management routes (authenticated, owner only)
app.use('/v1/users', userRoutes)

// Customer routes (authenticated)
app.use('/v1/customers', customerRoutes)

// Property routes — nested under customers + flat for updates
app.use('/v1/customers/:customerId/properties', propertyNestedRoutes)
app.use('/v1/properties', propertyFlatRoutes)

// Service catalog + pricing routes (authenticated)
app.use('/v1/services', createServiceRoutes(db))
app.use('/v1/pricing-rules', createPricingRuleRoutes(db))

// Quote routes (authenticated)
app.use('/v1/quotes', quoteRoutes)

// PDF generation routes (authenticated, mounted on /v1/quotes)
app.use('/v1/quotes', createPdfRoutes(db, redis))

// Email routes (authenticated, mounted on /v1/quotes)
app.use('/v1/quotes', createEmailRoutes(db))

// Dashboard routes (authenticated, mounted on /v1/quotes and /v1/customers)
app.use('/v1/quotes', createDashboardRoutes(db))
app.use('/v1/customers', createCustomerRoutes(db))

// Local dev: serve generated PDFs from filesystem
if (process.env.NODE_ENV === 'development') {
  app.use('/storage/proposals', express.static(path.resolve('storage', 'proposals')))
}

// Cron: expire sent quotes past valid_until (nightly at 00:05 UTC)
scheduleExpireQuotesJob(db)

// Error handler (must be last)
app.use(errorHandler)

export default app
