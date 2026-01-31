import cors from "cors";

const allowedOrigins = [
    "https://apticrack.eesiiests.org",
    "https://admin.apticrack.eesiiests.org",
    "http://localhost:3000",
    "http://localhost:3001",
];

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        // allow server-to-server / curl / postman
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },

    credentials: true, // IMPORTANT for cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});