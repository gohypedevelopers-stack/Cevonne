const express = require("express");

const orderController = require("../controllers/order.controller");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", protect, orderController.createOrder);
router.get("/my", protect, orderController.getMyOrders);
router.get("/", protect, requireRole("ADMIN"), orderController.listOrders);
router.patch("/:id", protect, requireRole("ADMIN"), orderController.updateOrder);

module.exports = router;
