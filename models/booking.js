const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },

  // Stored as UTC midnight. A stay runs [checkIn, checkOut), so the checkout
  // day is not occupied and one guest may check out the same morning another
  // checks in.
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  nights: { type: Number, required: true, min: 1 },

  // What was actually charged, in paise, recomputed server-side. Keeping it
  // here means a later price change on the listing does not rewrite history.
  amount: { type: Number, required: true },

  status: {
    type: String,
    enum: ["confirmed", "cancelled"],
    default: "confirmed",
  },

  razorpayPaymentId: String,
  razorpayOrderId: String,
  createdAt: { type: Date, default: Date.now },
});

// Idempotency. A Razorpay order id identifies one payment attempt, so a
// double-clicked confirm or a retried request carries the id that is already
// stored and the index rejects the duplicate rather than booking twice.
// sparse:true keeps the pre-existing bookings that have no order id out of it.
bookingSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });

// Serves the availability lookup: bookings on this listing whose range
// overlaps the requested one.
bookingSchema.index({ listing: 1, status: 1, checkIn: 1, checkOut: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
