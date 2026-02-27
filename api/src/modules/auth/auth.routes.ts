import { Router } from 'express'
import { loginHandler, refreshHandler, logoutHandler } from './auth.controller.js'

const router = Router()

router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.post('/logout', logoutHandler)

export default router
