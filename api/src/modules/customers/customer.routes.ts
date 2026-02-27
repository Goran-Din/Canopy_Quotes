import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
} from './customer.controller.js'

const router = Router()

router.use(authenticate)

router.get('/', listCustomers)
router.post('/', createCustomer)
router.get('/:id', getCustomer)
router.put('/:id', updateCustomer)

export default router
