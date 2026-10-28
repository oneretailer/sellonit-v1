import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  loginHandler,
  meHandler,
  registerHandler,
  sendPhoneVerificationHandler,
  updatePhoneHandler,
  verifyEmailAndLoginHandler,
  verifyEmailHandler,
  verifyPhoneHandler,
  setBusinessIntentHandler,
} from '../../modules/auth/auth.handlers.js';

const router = Router();
router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.get('/me', requireAuth, meHandler);
router.patch('/me', requireAuth, updatePhoneHandler);
router.put('/business-intent', requireAuth, setBusinessIntentHandler);
router.post('/verify-email-and-login', verifyEmailAndLoginHandler);
router.post('/verify-email', verifyEmailHandler);
router.get('/verify-email/:token', verifyEmailHandler);
router.post('/send-phone-verification', sendPhoneVerificationHandler);
router.post('/verify-phone', verifyPhoneHandler);

export default router;
