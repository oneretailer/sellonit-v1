import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getSupplierProfileHandler,
  submitSupplierProfileHandler,
  upsertSupplierProfileHandler,
} from '../../modules/suppliers/supplier.handlers.js';

const router = Router();
router.use(requireAuth);
router.get('/profile', getSupplierProfileHandler);
router.put('/profile', upsertSupplierProfileHandler);
router.post('/profile/submit', submitSupplierProfileHandler);
router.get('/:businessId/profile', getSupplierProfileHandler);
router.put('/:businessId/profile', upsertSupplierProfileHandler);
router.post('/:businessId/profile/submit', submitSupplierProfileHandler);
export default router;
