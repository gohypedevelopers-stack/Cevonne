const express = require('express');

const productController = require('../controllers/product.controller');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', productController.listProducts);
router.get('/export', protect, requireRole('ADMIN'), productController.exportProducts);
router.post('/bulk-import', protect, requireRole('ADMIN'), productController.bulkImportProducts);
router.get('/:id', productController.getProduct);
router.post('/', protect, requireRole('ADMIN'), productController.createProduct);
router.put('/:id', protect, requireRole('ADMIN'), productController.updateProduct);
router.delete('/:id', protect, requireRole('ADMIN'), productController.deleteProduct);

module.exports = router;

export {};
