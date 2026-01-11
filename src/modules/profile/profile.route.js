import express from 'express';
import { getMyProfile, updateMyProfile } from './profile.controller.js';
import { requireAuth, requireEmailVerified } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Require authentication and email verification for all profile routes
router.use(requireAuth);
router.use(requireEmailVerified);

// Get user profile
router.get('/me', getMyProfile);

// Update user profile
router.put('/me', updateMyProfile);

export default router;