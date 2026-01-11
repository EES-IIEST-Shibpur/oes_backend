import { verifyToken } from "../services/token.service.js";

export const requireAuth = (req, res, next) => {
  // Check for token in cookies first, fallback to Authorization header for backward compatibility
  let token = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = verifyToken(token, process.env.JWT_ACCESS_SECRET);

    req.user = decoded; // { userId, role, emailVerified }
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireEmailVerified = (req, res, next) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      message: "Email not verified",
    });
  }

  next();
};