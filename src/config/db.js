import dotenv from "dotenv";
import { Sequelize } from "sequelize";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

const sequelize = new Sequelize(
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
                // Maps to PGSSLMODE=require
                sslmode: process.env.PGSSLMODE || "require",
                // Maps to channel binding requirement for Neon
                channelBinding: process.env.PGCHANNELBINDING || "require",
            }
            : {},
    }
);

export default sequelize;