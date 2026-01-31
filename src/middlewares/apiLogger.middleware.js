// middleware/accessLogger.js
export const accessLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
  });

  next();
};