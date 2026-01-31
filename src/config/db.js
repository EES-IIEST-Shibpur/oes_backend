import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

let sequelize = null;

export const createSequelizeInstance = () => {
    if (sequelize) {
        return sequelize;
    }

    sequelize = new Sequelize(
        process.env.PGDATABASE,
        process.env.PGUSER,
        process.env.PGPASSWORD,
        {
            host: process.env.PGHOST,
            dialect: "postgres",
            logging: false,

            dialectOptions: isProduction
                ? {
                    ssl: {
                        require: true,
                        rejectUnauthorized: false,
                    },
                    sslmode: process.env.PGSSLMODE || "require",
                    channelBinding: process.env.PGCHANNELBINDING || "require",
                }
                : {},
        }
    );

    return sequelize;
};

export const getSequelizeInstance = () => {
    if (!sequelize) {
        throw new Error("Database not initialized. Call createSequelizeInstance first.");
    }
    return sequelize;
};

export const initializeDatabase = async () => {
    try {
        const instance = createSequelizeInstance();
        await instance.authenticate();
        await instance.sync();
        console.log("Database connected & synced");
        return instance;
    } catch (error) {
        console.error("Failed to initialize database:", error.message);
        throw error;
    }
};

export const closeDatabase = async () => {
    if (sequelize) {
        await sequelize.close();
        sequelize = null;
        console.log("Database connection closed");
    }
};

// For backward compatibility - create but don't connect
export default createSequelizeInstance();