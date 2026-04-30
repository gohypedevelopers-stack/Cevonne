const express = require('express');

const reviewController = require('../controllers/review.controller');

const router = express.Router();

router.get('/', reviewController.listReviews);
router.get('/:id', reviewController.getReview);
router.post('/', reviewController.createReview);
router.put('/:id', reviewController.updateReview);
router.delete('/:id', reviewController.deleteReview);

module.exports = router;
