const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const { isLoggedIn, isLoggedInApi } = require("../middleware");

// Confirms a payment and records the booking.
//
// Razorpay signs "<order_id>|<payment_id>" with our key secret and returns that
// signature to the browser. Recomputing it here is the only proof the payment
// actually happened: before this check the route trusted whatever payment id the
// client posted, so anyone could send a made-up id and get a free booking.
function isSignatureValid({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(razorpaySignature, "utf8");

  // Length check first: timingSafeEqual throws on mismatched lengths.
  // Comparing this way keeps the check constant-time.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

//  Create Booking after payment
router.post("/", isLoggedInApi, async (req, res) => {
  const { listingId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

  if (!listingId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    return res.status(400).json({ success: false, message: "Missing payment details" });
  }

  if (!isSignatureValid({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
    console.warn("Rejected booking — invalid Razorpay signature", {
      razorpayOrderId,
      user: req.user._id.toString(),
    });
    return res.status(400).json({ success: false, message: "Payment verification failed" });
  }

  try {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    await Booking.create({
      user: req.user._id,
      listing: listingId,
      razorpayPaymentId,
      razorpayOrderId,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Booking creation failed:", err);
    res.status(500).json({ success: false, message: "Could not save booking" });
  }
});

//  View user bookings
router.get("/mine", isLoggedIn, async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }).populate("listing");
  res.render("bookings/index", { bookings, currUser: req.user });
});

//  Cancel a booking
router.delete("/:id", isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking || booking.user.toString() !== req.user._id.toString()) {
      req.flash("error", "Unauthorized");
      return res.redirect("/bookings/mine");
    }

    await Booking.findByIdAndDelete(req.params.id);
    req.flash("success", "Booking cancelled successfully.");
    res.redirect("/bookings/mine");
  } catch (err) {
    console.error("Error cancelling booking:", err);
    req.flash("error", "Something went wrong");
    res.redirect("/bookings/mine");
  }
});

module.exports = router;
