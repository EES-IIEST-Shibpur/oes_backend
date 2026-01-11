import bcrypt from "bcrypt";
import sequelize from "../../config/db.js";
import User from "./auth.model.js";
import { generateAccessToken, generateEmailVerificationToken, verifyToken } from "../../services/token.service.js";
import { sendEmail } from "../../services/email.service.js";
import { verifyEmailTemplate } from "../../templates/verifyEmail.template.js";
import { generateOTP } from "../../utils/generateOTP.util.js";
import { forgotPasswordTemplate } from "../../templates/forgotPassword.template.js";
import { cryptoUtil } from "../../utils/crypto.util.js";
import { changePasswordTemplate } from "../../templates/changePassword.template.js";

//Signup Controller
export const signup = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { fullName, email, password } = req.body;

        // Validate required fields
        if (!fullName) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Full name is required",
            });
        }

        if (!email) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Email is required",
            });
        }

        if (!password) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Password is required",
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Please enter a valid email address",
            });
        }

        // Validate password strength
        if (password.length < 6) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Password must be at least 6 characters long",
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({
            where: { email },
            transaction,
        });

        if (existingUser) {
            await transaction.rollback();
            return res.status(409).json({
                message: "Email already registered. Please log in or use a different email.",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create(
            {
                fullName,
                email,
                hashedPassword,
                emailVerified: false,
            },
            { transaction }
        );

        const token = generateEmailVerificationToken(user);
        const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

        try {
            await sendEmail({
                to: user.email,
                subject: "Verify your email",
                html: verifyEmailTemplate({
                    fullName: user.fullName,
                    verifyUrl,
                }),
            });
        } catch (error) {
            console.error("Failed to send verification email:", error);
        }

        await transaction.commit();

        return res.status(201).json({
            message: "Signup successful. Please verify your email.",
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Signup error:", error);
        return res.status(500).json({
            message: "Signup failed. Please try again later.",
        });
    }
};

//Verify Email Controller
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                message: "Verification token is required",
            });
        }

        let payload;
        try {
            payload = verifyToken(token, process.env.JWT_EMAIL_SECRET);
        } catch {
            return res.status(400).json({
                message: "Invalid or expired verification link",
            });
        }

        if (payload.purpose !== "EMAIL_VERIFICATION") {
            return res.status(400).json({
                message: "Invalid verification token",
            });
        }

        const user = await User.findByPk(payload.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        if (user.emailVerified) {
            return res.status(200).json({
                message: "Email already verified",
            });
        }

        await user.update({ emailVerified: true });

        return res.status(200).json({
            message: "Email verified successfully",
        });
    } catch (error) {
        console.error("Email verification error:", error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

//Resend Verification Email
export const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.emailVerified) {
            return res.status(400).json({ message: "Email already verified" });
        }

        const token = generateEmailVerificationToken(user);
        const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

        await sendEmail({
            to: user.email,
            subject: "Verify your email",
            html: verifyEmailTemplate({
                fullName: user.fullName,
                verifyUrl,
            }),
        });

        return res.status(200).json({
            message: "Verification email sent",
        });
    } catch (error) {
        console.error("Resend email error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

//Login Controller
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate inputs
        if (!email) {
            return res.status(400).json({
                message: "Email is required",
            });
        }

        if (!password) {
            return res.status(400).json({
                message: "Password is required",
            });
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid email address",
            });
        }

        const user = await User.findOne({
            where: { email },
        });

        if (!user) {
            return res.status(401).json({
                message: "Email not found. Please check your email or sign up.",
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.hashedPassword
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Incorrect password. Please try again.",
            });
        }

        // Check if email is verified
        if (!user.emailVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in.",
                email: user.email,
            });
        }

        const accessToken = generateAccessToken(user);

        return res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
            accessToken,
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "Login failed. Please try again later.",
        });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email input
        if (!email) {
            return res.status(400).json({
                message: "Email is required",
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid email address",
            });
        }

        const user = await User.findOne({ where: { email } });

        // Don't reveal if email exists or not for security
        if (!user) {
            return res.status(200).json({
                message: "If an account with this email exists, an OTP has been sent to your email",
            });
        }

        const otp = generateOTP(6);

        const saltRounds = 10;
        const hashedOTP = await bcrypt.hash(otp, saltRounds);

        user.passwordResetOTP = hashedOTP;
        user.passwordResetOTPExpiry = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        try {
            await sendEmail({
                to: user.email,
                subject: "Password Reset OTP",
                html: forgotPasswordTemplate({
                    fullName: user.fullName,
                    otp,
                }),
            });
        } catch (error) {
            console.error("Failed to send OTP email:", error);
        }

        return res.status(200).json({
            message: "If an account with this email exists, an OTP has been sent to your email",
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({
            message: "Failed to process password reset. Please try again later.",
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Validate all fields
        if (!email) {
            return res.status(400).json({
                message: "Email is required",
            });
        }

        if (!otp) {
            return res.status(400).json({
                message: "OTP is required",
            });
        }

        if (!newPassword) {
            return res.status(400).json({
                message: "New password is required",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters long",
            });
        }

        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(400).json({
                message: "Invalid email or OTP. Please try again.",
            });
        }

        if (!user.passwordResetOTP || !user.passwordResetOTPExpiry) {
            return res.status(400).json({
                message: "OTP is invalid or expired. Please request a new one.",
            });
        }

        if (user.passwordResetOTPExpiry < new Date()) {
            return res.status(400).json({
                message: "OTP has expired. Please request a new one.",
            });
        }

        const isOTPValid = await bcrypt.compare(
            String(otp),
            String(user.passwordResetOTP)
        );

        if (!isOTPValid) {
            return res.status(400).json({
                message: "Invalid OTP. Please check and try again.",
            });
        }

        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        user.hashedPassword = newHashedPassword;
        user.passwordResetOTP = null;
        user.passwordResetOTPExpiry = null;

        await user.save();

        return res.status(200).json({
            message: "Password reset successfully. Please log in with your new password.",
        });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({
            message: "Failed to reset password. Please try again later.",
        });
    }
};

export const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        // Validate inputs
        if (!currentPassword) {
            return res.status(400).json({
                message: "Current password is required",
            });
        }

        if (!newPassword) {
            return res.status(400).json({
                message: "New password is required",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "New password must be at least 6 characters long",
            });
        }

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        const isMatch = await cryptoUtil.compare(
            currentPassword,
            user.hashedPassword
        );

        if (!isMatch) {
            return res.status(400).json({
                message: "Current password is incorrect",
            });
        }

        const isSamePassword = await cryptoUtil.compare(
            String(newPassword),
            String(user.hashedPassword)
        );

        if (isSamePassword) {
            return res.status(400).json({
                message: "New password must be different from your current password",
            });
        }

        const hashedPassword = await cryptoUtil.hash(newPassword);
        user.hashedPassword = hashedPassword;

        await user.save();

        try {
            await sendEmail({
                to: user.email,
                subject: "Password Changed Successfully",
                html: changePasswordTemplate({
                    fullName: user.fullName,
                    time: new Date().toLocaleString(),
                    ip: req.ip,
                    device: req.headers["user-agent"],
                }),
            });
        } catch (error) {
            console.error("Failed to send change password email:", error);
        }

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });
    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({
            message: "Server error: change password",
        });
    }
};