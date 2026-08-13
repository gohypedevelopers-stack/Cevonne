const express = require('express');

const userController = require('../controllers/user.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', userController.signup);
router.post('/signin', userController.signin);
router.post('/verify-otp', userController.verifyOTP);
router.post('/forgot-password', userController.forgotPassword);

router.post('/reset-password/:token', userController.resetPassword);

router.get('/me', protect, userController.getProfile);
router.patch('/me', protect, userController.updateProfile);
router.get('/', protect, requireRole('ADMIN'), userController.listUsers);
router.patch('/:id/role', protect, requireRole('ADMIN'), userController.updateRole);

module.exports = router;

export {};
