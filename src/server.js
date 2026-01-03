import app from "./app.js";
import sequelize from "./config/db.js";
import { verifyEmailTransporter } from "./services/email.service.js";

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {
        // Database
        await sequelize.authenticate();
        await sequelize.sync();
        console.log("Database connected & synced");

        // Email
        verifyEmailTransporter();
        console.log("Email transporter verified");

        // Server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
};

startServer();