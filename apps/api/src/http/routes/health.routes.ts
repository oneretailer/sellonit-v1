import { liveCheck, readinessCheck } from '../../modules/health/health.js';
import express from 'express';

const router = express.Router();

router.get('/', liveCheck);
router.get('/ready', readinessCheck);

export default router;
