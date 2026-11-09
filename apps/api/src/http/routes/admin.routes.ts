import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import {
  approveAdminSupplierHandler,
  getAdminSupplierHandler,
  listAdminSuppliersHandler,
  rejectAdminSupplierHandler,
  reinstateAdminSupplierHandler,
  suspendAdminSupplierHandler,
} from '../../modules/admin/admin.handlers.js';

const router = Router();
router.use(requireAuth);
router.get('/suppliers', requirePermission('admin:read'), listAdminSuppliersHandler);
router.get('/suppliers/:id', requirePermission('admin:read'), getAdminSupplierHandler);
router.post(
  '/suppliers/:id/approve',
  requirePermission('admin:write'),
  approveAdminSupplierHandler,
);
router.post('/suppliers/:id/reject', requirePermission('admin:write'), rejectAdminSupplierHandler);
router.post(
  '/suppliers/:id/suspend',
  requirePermission('admin:write'),
  suspendAdminSupplierHandler,
);
router.post(
  '/suppliers/:id/reinstate',
  requirePermission('admin:write'),
  reinstateAdminSupplierHandler,
);
export default router;
