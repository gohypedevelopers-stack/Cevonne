const express = require('express');

const shadeController = require('../controllers/shade.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', shadeController.listShades);
router.get('/:id', shadeController.getShade);
router.post('/', protect, requireRole('ADMIN'), shadeController.createShade);
router.put('/:id', protect, requireRole('ADMIN'), shadeController.updateShade);
router.delete('/:id', protect, requireRole('ADMIN'), shadeController.deleteShade);

module.exports = router;

export {};
