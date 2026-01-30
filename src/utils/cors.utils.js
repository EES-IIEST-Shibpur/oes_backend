export const getCorsOrigins = () => {
    const origins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(",").map(x => x.trim())
        : ["http://localhost:3000", "http://localhost:3001"];
    
    return origins;
};