const express = require('express');

const collectionController = require('../controllers/collection.controller');

const router = express.Router();

router.get('/', collectionController.listCollections);
router.get('/:id', collectionController.getCollection);
router.post('/', collectionController.createCollection);
router.put('/:id', collectionController.updateCollection);
router.delete('/:id', collectionController.deleteCollection);

module.exports = router;
