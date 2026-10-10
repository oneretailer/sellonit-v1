import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createBusinessHandler,
  listBusinessesHandler,
} from '../../modules/businesses/businesses.handlers.js';

const router = Router();
router.use(requireAuth);
router.get('/', listBusinessesHandler);
router.post('/', createBusinessHandler);
export default router;
