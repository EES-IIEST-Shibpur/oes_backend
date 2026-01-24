import express from "express";
import apiRoutes from "./routes/index.js";
import "./modules/association/index.js";
import "./cron/autoSubmitExamAttempts.cron.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import { accessLogger } from "./middlewares/apiLogger.middleware.js";


const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// CORS configuration to allow credentials
const origins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(x => x.trim())
    : [];

app.use(cors({
    origin: function (origin, callback) {
        // Allow server-to-server or tools like Postman
        if (!origin) return callback(null, true);

        if (origins.includes(origin)) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(accessLogger);

app.use("/api", apiRoutes);

export default app;