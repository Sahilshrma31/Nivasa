const express = require("express");
const router = express.Router();
const razorpay = require("../utils/razorpay");
const Listing = require("../models/listing");
const { isLoggedInApi } = require("../middleware");
const { parseStay, StayDateError } = require("../utils/stayDates");
const { findOverlappingBooking } = require("../utils/availability");

// Create a Razorpay order for a stay.
//
// The client sends the listing id and the dates, never the amount. Price comes
// off the listing document and the night count comes from the parsed dates, so
// a tampered body cannot change what is charged.
//
// The dates are recorded in the order's notes. That makes the order the record
// of what was agreed: when the booking is confirmed later it reads the dates
// back from Razorpay instead of trusting the browser a second time.
router.post("/create-order", isLoggedInApi, async (req, res) => {
  const { listingId, checkIn, checkOut } = req.body;

  if (!listingId) return res.status(400).json({ error: "listingId is required" });

  let stay;
  try {
    stay = parseStay(checkIn, checkOut);
  } catch (err) {
    if (err instanceof StayDateError) return res.status(400).json({ error: err.message });
    throw err;
  }

  try {
    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    // Advisory only. The binding check runs under a lock when the booking is
    // confirmed; this one just avoids sending someone to a payment screen for
    // dates that are already visibly taken.
    const clash = await findOverlappingBooking(listingId, stay.checkIn, stay.checkOut);
    if (clash) {
      return res.status(409).json({ error: "Those dates are already booked." });
    }

    const amount = Math.round(listing.price * 100) * stay.nights;

    const order = await razorpay.orders.create({
      amount, // paise
      currency: "INR",
      receipt: `rcpt_${listingId}_${Date.now()}`,
      notes: {
        listingId: listing._id.toString(),
        userId: req.user._id.toString(),
        checkIn: stay.checkIn.toISOString(),
        checkOut: stay.checkOut.toISOString(),
        nights: String(stay.nights),
      },
    });

    res.json(order);
  } catch (err) {
    console.error("Order creation failed", err);
    res.status(500).json({ error: "Unable to create order" });
  }
});

module.exports = router;
