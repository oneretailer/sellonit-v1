import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.middleware.js';
import {
  getSupplierProfileHandler,
  submitSupplierProfileHandler,
  upsertSupplierProfileHandler,
} from '../../modules/suppliers/supplier.handlers.js';
import { publishProductHandler } from '../../modules/supplier-products/publish.handlers.js';
import {
  createProductHandler,
  getProductHandler,
  listProductsHandler,
  updatePricingRuleHandler,
  updateProductHandler,
} from '../../modules/supplier-products/product.handlers.js';

const router = Router();
router.use(requireAuth);
router.get('/products', requirePermission('product:read'), listProductsHandler);
router.post('/products', requirePermission('product:write'), createProductHandler);
router.get('/products/:id', requirePermission('product:read'), getProductHandler);
router.patch('/products/:id', requirePermission('product:write'), updateProductHandler);
router.put(
  '/products/:id/pricing-rule',
  requirePermission('pricing:set'),
  updatePricingRuleHandler,
);
router.post(
  '/products/:productId/publish',
  requirePermission('product:write'),
  publishProductHandler,
);
router.get('/profile', getSupplierProfileHandler);
router.put('/profile', upsertSupplierProfileHandler);
router.post('/profile/submit', submitSupplierProfileHandler);
router.get('/:businessId/profile', getSupplierProfileHandler);
router.put('/:businessId/profile', upsertSupplierProfileHandler);
router.post('/:businessId/profile/submit', submitSupplierProfileHandler);
export default router;
