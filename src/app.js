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
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(accessLogger);

app.use("/api", apiRoutes);

export default app;