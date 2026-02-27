import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import {
  listProperties,
  createProperty,
  updateProperty,
} from './property.controller.js'

// Nested routes: /v1/customers/:customerId/properties
const nestedRouter = Router({ mergeParams: true })
nestedRouter.use(authenticate)
nestedRouter.get('/', listProperties)
nestedRouter.post('/', createProperty)

// Flat routes: /v1/properties/:id
const flatRouter = Router()
flatRouter.use(authenticate)
flatRouter.put('/:id', updateProperty)

export { nestedRouter as propertyNestedRoutes, flatRouter as propertyFlatRoutes }
