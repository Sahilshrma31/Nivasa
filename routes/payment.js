const express = require("express");
const router = express.Router();
const razorpay = require("../utils/razorpay");

router.post("/create-order", async (req, res) => {
  const { amount } = req.body;

  try {
    const options = {
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error("Order creation failed", err);
    res.status(500).json({ error: "Unable to create order" });
  }
});

module.exports = router;
