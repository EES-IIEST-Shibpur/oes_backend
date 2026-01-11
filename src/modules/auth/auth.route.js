import express from 'express';
import {
    signup,
    login,
    logout,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword,
} from './auth.controller.js';

import {
    loginLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
} from '../../middlewares/rateLimit.middleware.js';

import {
    requireAuth,
    requireEmailVerified,
} from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);

router.post('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

router.post(
    '/change-password',
    requireAuth,
    requireEmailVerified,
    changePassword
);

export default router;