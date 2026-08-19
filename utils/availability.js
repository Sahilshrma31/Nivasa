const Booking = require("../models/booking");

// Two half-open ranges [aIn, aOut) and [bIn, bOut) overlap when each starts
// before the other ends. Written as a query that is the reason for the
// { listing, status, checkIn, checkOut } index on the booking model.
//
// status is matched with $ne rather than "confirmed" so that bookings written
// before this field existed still count as occupying their dates.
function findOverlappingBooking(listingId, checkIn, checkOut) {
  return Booking.findOne({
    listing: listingId,
    status: { $ne: "cancelled" },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  });
}

module.exports = { findOverlappingBooking };
