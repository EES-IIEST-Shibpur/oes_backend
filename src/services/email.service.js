import nodemailer from "nodemailer";

const SMTP_PORT = Number(process.env.SMTP_PORT);

const SMTP_SECURE = SMTP_PORT === 465;

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const verifyEmailTransporter = async () => {
    try {
        await transporter.verify();
        console.log("SMTP server is ready to send emails");
    } catch (error) {
        console.error("SMTP configuration error:", error.message);
    }
};

export const sendEmail = async ({ to, subject, html }) => {
    try {
        const info = await transporter.sendMail({
            from: `"Electrical Engineers' Society" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        });

        return info;
    } catch (error) {
        console.error("Email sending failed:", {
            to,
            subject,
            error: error.message,
        });

        throw new Error("Failed to send email");
    }
};