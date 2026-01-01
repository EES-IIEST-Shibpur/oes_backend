import express from 'express';
import { getMyProfile, updateMyProfile } from './profile.controller.js';
import { requireAuth, requireEmailVerified } from '../../middlewares/auth.middleware.js';

const router = express();

router.get('/me', requireAuth, requireEmailVerified, getMyProfile);
router.put('/me', requireAuth, requireEmailVerified, updateMyProfile);

export default router;