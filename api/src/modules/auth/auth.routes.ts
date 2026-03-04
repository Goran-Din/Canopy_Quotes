import { Router } from 'express'
import { loginHandler, refreshHandler, logoutHandler, changePasswordHandler } from './auth.controller.js'
import { authenticate } from '../../middleware/authenticate.js'

const router = Router()

router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.post('/logout', logoutHandler)
router.post('/change-password', authenticate, changePasswordHandler)

export default router
