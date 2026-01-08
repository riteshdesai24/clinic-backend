/**
 * ============================
 * CENTRAL ERROR HANDLER
 * ============================
 * IMPORTANT:
 * ❌ Do NOT use try/catch here
 * ❌ Do NOT throw errors here
 * ✔ This is the FINAL middleware
 */
module.exports = (err, req, res, next) => {
  console.error(err);

  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
};
