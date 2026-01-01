import { verifyToken } from "../services/token.service.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  const decoded = verifyToken(token, process.env.JWT_ACCESS_SECRET);

  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  req.user = decoded; // { userId, role, emailVerified: user.email_verified }
  next();
};

export const requireEmailVerified = (req, res, next) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      message: "Email not verified",
    });
  }

  next();
};