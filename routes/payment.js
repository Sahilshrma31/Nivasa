const express = require("express");
const router = express.Router();
const razorpay = require("../utils/razorpay");
const Listing = require("../models/listing");
const { isLoggedInApi } = require("../middleware");

// Create a Razorpay order for a listing.
//
// The client sends only the listing id. The amount is read from the database,
// never from the request body — a client-supplied amount meant anyone could
// open DevTools, post `amount: 1`, and book a ₹50,000 stay for one rupee.
// The listing document is the single source of truth for price.
router.post("/create-order", isLoggedInApi, async (req, res) => {
  const { listingId } = req.body;

  if (!listingId) {
    return res.status(400).json({ error: "listingId is required" });
  }

  try {
    const listing = await Listing.findById(listingId);

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(listing.price * 100), // paise; round guards against float drift
      currency: "INR",
      receipt: `rcpt_${listingId}_${Date.now()}`,
      // Carried back on the webhook, so a payment can be tied to its listing
      // and buyer without trusting whatever the browser reports later.
      notes: {
        listingId: listing._id.toString(),
        userId: req.user._id.toString(),
      },
    });

    res.json(order);
  } catch (err) {
    console.error("Order creation failed", err);
    res.status(500).json({ error: "Unable to create order" });
  }
});

module.exports = router;
