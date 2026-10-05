import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { loginHandler, meHandler, registerHandler } from '../../modules/auth/auth.handlers.js';

const router = Router();
router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.get('/me', requireAuth, meHandler);

export default router;
