const express = require("express");
const router = express.Router();
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const {isLoggedIn}=require("../middleware")

// Create Booking after payment
router.post("/", async (req, res) => {
  const { listingId, razorpayPaymentId, razorpayOrderId } = req.body;

  await Booking.create({
    user: req.user._id,
    listing: listingId,
    razorpayPaymentId,
    razorpayOrderId,
  });

  res.status(200).json({ success: true });
});

// View user bookings
router.get("/mine", async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }).populate("listing");
  res.render("bookings/index", { bookings });
});

router.delete("/:id", isLoggedIn, async (req, res) => {
    await Booking.findByIdAndDelete(req.params.id);
    res.redirect("/bookings");
  });



module.exports = router;
