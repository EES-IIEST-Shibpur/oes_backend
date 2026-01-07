import express from "express";
import apiRoutes from "./routes/index.js";
import "./modules/association/index.js";
import "./cron/autoSubmitExamAttempts.cron.js";
import cors from "cors";
import { accessLogger } from "./middlewares/apiLogger.middleware.js";


const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(cors());
app.use(express.json());
app.use(accessLogger);

app.use("/api", apiRoutes);

export default app;