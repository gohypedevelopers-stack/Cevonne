const express = require('express');

const inventoryController = require('../controllers/inventory.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', inventoryController.listInventory);
router.get('/low', inventoryController.listLowStock);
router.put('/:shadeId', protect, requireRole('ADMIN'), inventoryController.updateInventory);

module.exports = router;

export {};
