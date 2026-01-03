import express from "express";
import apiRoutes from "./routes/index.js";
import "./modules/association/index.js";
import "./cron/autoSubmitExamAttempts.cron.js";

const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(express.json());

app.use("/api", apiRoutes);

export default app;