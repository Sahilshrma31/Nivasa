const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const razorpay = require("../utils/razorpay");
const { isLoggedIn, isLoggedInApi } = require("../middleware");
const { findOverlappingBooking } = require("../utils/availability");
const {
  withListingLock,
  LockBusyError,
  LockUnavailableError,
} = require("../utils/listingLock");

// Razorpay signs "<order_id>|<payment_id>" with our key secret and hands that
// signature to the browser. Recomputing it is the only proof the payment
// happened: without it any payment id posted by a client would be accepted.
function isSignatureValid({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(razorpaySignature, "utf8");

  // Length first: timingSafeEqual throws when the buffers differ in size.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

//  Create Booking after payment
router.post("/", isLoggedInApi, async (req, res) => {
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

  if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
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
    // Retrying a request that already succeeded should not book a second time.
    // The unique index on razorpayOrderId is the real guard; checking here
    // first turns the common retry into a plain success instead of an error.
    const already = await Booking.findOne({ razorpayOrderId });
    if (already) {
      return res.status(200).json({ success: true, bookingId: already._id, duplicate: true });
    }

    // The order, not the request body, says what was bought. The body only
    // carries ids that were just proven authentic by the signature check.
    const order = await razorpay.orders.fetch(razorpayOrderId);
    const notes = order.notes || {};

    if (notes.userId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "This payment belongs to another account." });
    }

    const checkIn = new Date(notes.checkIn);
    const checkOut = new Date(notes.checkOut);
    const nights = Number(notes.nights);

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || !nights) {
      return res.status(400).json({ success: false, message: "This order is missing its stay dates." });
    }

    const listing = await Listing.findById(notes.listingId);
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    // Checking availability and writing the booking has to be one indivisible
    // step. Two guests paying for the same dates at the same moment would
    // otherwise both read "free" before either had written.
    const booking = await withListingLock(notes.listingId, async () => {
      const clash = await findOverlappingBooking(notes.listingId, checkIn, checkOut);
      if (clash) return null;

      return Booking.create({
        user: req.user._id,
        listing: notes.listingId,
        checkIn,
        checkOut,
        nights,
        amount: order.amount,
        razorpayPaymentId,
        razorpayOrderId,
      });
    });

    if (!booking) {
      // Paid, but the dates went in the moment before. Flagged for refund
      // rather than silently kept.
      console.error("PAID BUT UNAVAILABLE — refund required", {
        razorpayPaymentId,
        razorpayOrderId,
        user: req.user._id.toString(),
      });
      return res.status(409).json({
        success: false,
        message: "Those dates were just booked by someone else. Your payment will be refunded.",
      });
    }

    res.status(200).json({ success: true, bookingId: booking._id });
  } catch (err) {
    if (err instanceof LockBusyError) {
      return res.status(409).json({ success: false, message: err.message });
    }
    if (err instanceof LockUnavailableError) {
      return res.status(503).json({ success: false, message: err.message });
    }
    // Two identical requests in flight together: one wins the insert, the
    // other lands here. Same outcome as the retry check above.
    if (err.code === 11000) {
      const existing = await Booking.findOne({ razorpayOrderId });
      return res.status(200).json({ success: true, bookingId: existing?._id, duplicate: true });
    }
    console.error("Booking creation failed:", err);
    res.status(500).json({ success: false, message: "Could not save booking" });
  }
});

//  View user bookings
router.get("/mine", isLoggedIn, async (req, res) => {
  const bookings = await Booking.find({
    user: req.user._id,
    status: { $ne: "cancelled" },
  })
    .sort({ checkIn: 1 })
    .populate("listing");
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

    // Marked rather than deleted. The payment record has to survive for the
    // refund, and the dates are freed either way because the availability
    // query skips cancelled rows.
    //
    // updateOne rather than save(): bookings written before this schema gained
    // checkIn/checkOut/amount would fail required-field validation on a full
    // document save, and a guest should still be able to cancel those.
    await Booking.updateOne({ _id: booking._id }, { $set: { status: "cancelled" } });

    req.flash("success", "Booking cancelled successfully.");
    res.redirect("/bookings/mine");
  } catch (err) {
    console.error("Error cancelling booking:", err);
    req.flash("error", "Something went wrong");
    res.redirect("/bookings/mine");
  }
});

module.exports = router;
