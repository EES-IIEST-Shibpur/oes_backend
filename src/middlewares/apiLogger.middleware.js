// middleware/accessLogger.js
export const accessLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} in ${duration}ms`
    );
  });

  next();
};