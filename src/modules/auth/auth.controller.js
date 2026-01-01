import bcrypt from "bcrypt";
import sequelize from "../../config/db.js";
import User from "./auth.model.js";
import { generateAccessToken, generateEmailVerificationToken, verifyToken } from "../../services/token.service.js";
import { sendEmail } from "../../services/email.service.js";
import { verifyEmailTemplate } from "../../templates/verifyEmail.template.js";

//Signup Controller
export const signup = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { fullName, email, password } = req.body;

        const existingUser = await User.findOne({
            where: { email },
            transaction,
        });

        if (existingUser) {
            await transaction.rollback();
            return res.status(409).json({ message: "User already exists" });
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

        await sendEmail({
            to: user.email,
            subject: verifyEmailTemplate({
                fullName: user.fullName,
                verifyUrl,
            }),
        });

        await transaction.commit();

        return res.status(201).json({
            message: "Signup successful. Please verify your email.",
        });
    } catch (error) {
        await transaction.rollback();
        console.error("Signup error:", error);
        return res.status(500).json({ message: "Signup failed" });
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

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        const user = await User.findOne({
            where: { email },
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.hashedPassword
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const accessToken = generateAccessToken(user);

        return res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            accessToken,
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "Internal server error",
        });
    }
};