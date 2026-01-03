import express from 'express';
import { getMyProfile, updateMyProfile } from './profile.controller.js';
import { requireAuth, requireEmailVerified } from '../../middlewares/auth.middleware.js';

const router = express();

router.use(requireAuth);
router.use(requireEmailVerified);

router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);

export default router;