import express from "express";
import apiRoutes from "./routes/index.js";
import cookieParser from "cookie-parser";
import { accessLogger } from "./middlewares/apiLogger.middleware.js";

const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(express.json());
app.use(cookieParser());
app.use(accessLogger);

app.use("/api", apiRoutes);

export default app;