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
    requireAuth,
    requireEmailVerified,
} from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);

router.post('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.post(
    '/change-password',
    requireAuth,
    requireEmailVerified,
    changePassword
);

export default router;