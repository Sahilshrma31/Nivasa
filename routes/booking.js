const express = require("express");
const router = express.Router();
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const { isLoggedIn } = require("../middleware");

//  Create Booking after payment
router.post("/", isLoggedIn, async (req, res) => {
  const { listingId, razorpayPaymentId, razorpayOrderId } = req.body;

  await Booking.create({
    user: req.user._id,
    listing: listingId,
    razorpayPaymentId,
    razorpayOrderId,
  });

  res.status(200).json({ success: true });
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
