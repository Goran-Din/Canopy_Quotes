import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import authRoutes from './modules/auth/auth.routes.js'
import customerRoutes from './modules/customers/customer.routes.js'
import {
  propertyNestedRoutes,
  propertyFlatRoutes,
} from './modules/properties/property.routes.js'
import { errorHandler } from './middleware/error-handler.js'

const app = express()

// Security & parsing middleware
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }))
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

// Customer routes (authenticated)
app.use('/v1/customers', customerRoutes)

// Property routes — nested under customers + flat for updates
app.use('/v1/customers/:customerId/properties', propertyNestedRoutes)
app.use('/v1/properties', propertyFlatRoutes)

// Error handler (must be last)
app.use(errorHandler)

export default app
