import express from 'express';
import authRoutes from '../modules/auth/auth.route.js';
import profileRoutes from '../modules/profile/profile.route.js';
import questionRoutes from '../modules/question/question.route.js';
import examRoutes from '../modules/exam/exam.route.js';

const router = express();

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/question", questionRoutes);
router.use("/exam", examRoutes);

export default router;