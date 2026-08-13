const express = require('express');

const userController = require('../controllers/user.controller');
const { protect, requireRole } = require('../middleware/auth');
const { consumeRateLimit } = require('../security/rate-limit');

const router = express.Router();

const authRateLimit = (action) => async (req, res, next) => {
  const limit = action === "forgot-password" ? 3 : action === "reset-password" ? 5 : 5;
  const windowMs = action === "forgot-password" || action === "reset-password" ? 60 * 60 * 1000 : 15 * 60 * 1000;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers || {})) {
    if (typeof value === "string") headers.set(name, value);
  }
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const result = await consumeRateLimit({ headers }, `auth:${action}`, { limit, windowMs, identifier: email });
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    return res.status(429).json({ message: "Too many attempts. Please try again later." });
  }
  return next();
};

router.post('/signup', authRateLimit("signup"), userController.signup);
router.post('/signin', authRateLimit("signin"), userController.signin);
router.post('/verify-otp', authRateLimit("verify-otp"), userController.verifyOTP);
router.post('/forgot-password', authRateLimit("forgot-password"), userController.forgotPassword);

router.post('/reset-password/:token', authRateLimit("reset-password"), userController.resetPassword);

router.get('/me', protect, userController.getProfile);
router.patch('/me', protect, userController.updateProfile);
router.get('/', protect, requireRole('ADMIN'), userController.listUsers);
router.patch('/:id/role', protect, requireRole('ADMIN'), userController.updateRole);

module.exports = router;

export {};
