import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load environment variables based on NODE_ENV
 * NODE_ENV must be provided externally (not in .env files)
 * Defaults to 'development' if not set
 */
export const loadEnvironment = () => {
    // Default to development if NODE_ENV is not set
    // Trim to handle Windows 'set' command adding trailing spaces
    const NODE_ENV = (process.env.NODE_ENV || "development").trim();

    // Construct the path to the .env file
    const envFile = `.env.${NODE_ENV}`;
    const envPath = path.resolve(__dirname, "..", "..", envFile);

    // Load the environment file
    const result = dotenv.config({ path: envPath });

    if (result.error) {
        console.error(`   Failed to load ${envFile}:`, result.error.message);
        console.error(`   Expected file at: ${envPath}`);
        throw new Error(`Environment file ${envFile} not found`);
    }

    console.log(`Loaded environment: ${envFile}`);
    console.log(`NODE_ENV: ${NODE_ENV}`);

    return NODE_ENV;
};
