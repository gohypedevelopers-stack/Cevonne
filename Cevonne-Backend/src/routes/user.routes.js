const express = require('express');

const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', userController.signup);
router.post('/signin', userController.signin);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password/:token', userController.resetPassword);

router.get('/me', protect, userController.getProfile);
router.patch('/me', protect, userController.updateProfile);
router.get('/', userController.listUsers);
router.patch('/:id/role', userController.updateRole);

module.exports = router;
