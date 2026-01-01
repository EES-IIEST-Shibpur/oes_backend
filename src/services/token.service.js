import jwt from "jsonwebtoken";

export const generateAccessToken = (user) => {
  if (!process.env.JWT_ACCESS_SECRET) throw new Error("Missing JWT_ACCESS_SECRET env var");

  const payload = {
    userId: user.id,
    role: user.role,
    emailVerified: user.emailVerified,
  };

  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "7d",
  });
};

export const generateEmailVerificationToken = (user) => {
  if (!process.env.JWT_EMAIL_SECRET) throw new Error("Missing JWT_EMAIL_SECRET env var");

  const payload = {
    userId: user.id,
    purpose: "EMAIL_VERIFICATION",
  };

  return jwt.sign(payload, process.env.JWT_EMAIL_SECRET, {
    expiresIn: "24h",
  });
};

export const verifyToken = (token, secret) => {
  if (!secret) throw new Error("Missing secret for token verification");
  return jwt.verify(token, secret);
};