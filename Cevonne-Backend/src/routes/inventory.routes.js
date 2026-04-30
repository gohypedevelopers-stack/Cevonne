const express = require('express');

const inventoryController = require('../controllers/inventory.controller');

const router = express.Router();

router.get('/', inventoryController.listInventory);
router.get('/low', inventoryController.listLowStock);
router.put('/:shadeId', inventoryController.updateInventory);

module.exports = router;
