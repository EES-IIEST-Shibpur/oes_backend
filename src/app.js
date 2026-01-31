import express from "express";
import apiRoutes from "./routes/index.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import { accessLogger } from "./middlewares/apiLogger.middleware.js";

const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

/*
// CORS configuration to allow credentials
const origins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(x => x.trim())
    : ["http://localhost:3000", "http://localhost:3001"]; // Fallback for development

console.log("CORS_ORIGINS env:", process.env.CORS_ORIGINS);
console.log("CORS allowed origins:", origins);

app.use(cors({
    origin: function (origin, callback) {
        // Allow server-to-server or tools like Postman
        if (!origin) return callback(null, true);

        if (origins.includes(origin)) {
            return callback(null, true);
        }

        // Log rejected origins for debugging
        console.warn(`CORS: Rejected origin: ${origin}. Allowed: ${origins.join(', ')}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
*/

app.use(express.json());
app.use(cookieParser());
app.use(accessLogger);

app.use("/api", apiRoutes);

export default app;