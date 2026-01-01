import express from 'express';
import authRoutes from '../modules/auth/auth.route.js';
import profileRoutes from '../modules/profile/profile.route.js';

const router = express();

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);

export default router;