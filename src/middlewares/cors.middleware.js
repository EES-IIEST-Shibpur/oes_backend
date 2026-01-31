import cors from "cors";

const allowedOrigins = [
    "https://apticrack.eesiiests.org",
    "https://admin.apticrack.eesiiests.org",
    "http://localhost:3000",
    "http://localhost:3001",
];

const corsOptions = {
    origin: (origin, callback) => {
        // allow server-to-server (no origin) like curl/postman
        if (!origin) return callback(null, true);

        // exact match
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // allow subdomains of eesiiests.org (e.g. *.eesiiests.org)
        try {
            const url = new URL(origin);
            if (url.hostname && url.hostname.endsWith("eesiiests.org")) return callback(null, true);
        } catch (e) {
            // ignore parse errors
        }

        return callback(null, false);
    },
    credentials: true, // send Access-Control-Allow-Credentials
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    optionsSuccessStatus: 204,
};

export const corsMiddleware = (req, res, next) => {
    cors(corsOptions)(req, res, (err) => {
        if (err) return res.status(403).json({ message: "CORS blocked", details: err.message });

        // Ensure preflight receives a quick, successful response
        if (req.method === "OPTIONS") return res.sendStatus(204);

        next();
    });
};