import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetPassword,
} from './user.controller.js'

const router = Router()

router.use(authenticate)

router.get('/', requireRole('owner', 'n37_super_admin'), listUsers)
router.post('/', requireRole('owner', 'n37_super_admin'), createUser)
router.put('/:id', requireRole('owner', 'n37_super_admin'), updateUser)
router.put('/:id/deactivate', requireRole('owner', 'n37_super_admin'), deactivateUser)
router.put('/:id/reactivate', requireRole('owner', 'n37_super_admin'), reactivateUser)
router.put('/:id/reset-password', requireRole('owner', 'n37_super_admin'), resetPassword)

export default router
