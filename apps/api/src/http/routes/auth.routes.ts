import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  loginHandler,
  meHandler,
  registerHandler,
  sendPhoneVerificationHandler,
  updatePhoneHandler,
  verifyEmailHandler,
  verifyPhoneHandler,
} from '../../modules/auth/auth.handlers.js';

const router = Router();
router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.get('/me', requireAuth, meHandler);
router.patch('/me', requireAuth, updatePhoneHandler);
router.post('/verify-email', verifyEmailHandler);
router.get('/verify-email/:token', verifyEmailHandler);
router.post('/send-phone-verification', sendPhoneVerificationHandler);
router.post('/verify-phone', verifyPhoneHandler);

export default router;
