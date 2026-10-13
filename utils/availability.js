const Booking = require("../models/booking");

// Two half-open ranges [aIn, aOut) and [bIn, bOut) overlap when each starts
// before the other ends.
//
// status is matched with $ne rather than "confirmed" so that bookings written
// before this field existed still count as occupying their dates.
const overlaps = (checkIn, checkOut) => ({
  status: { $ne: "cancelled" },
  checkIn: { $lt: checkOut },
  checkOut: { $gt: checkIn },
});

// "Is this listing taken on these dates?" — backed by the
// { listing, status, checkIn, checkOut } index.
function findOverlappingBooking(listingId, checkIn, checkOut) {
  return Booking.findOne({ listing: listingId, ...overlaps(checkIn, checkOut) });
}

// "Is this guest already staying somewhere on these dates?" — a person cannot
// be in two places at once, so an overlapping stay at ANY listing blocks the
// booking. Backed by the { user, status, checkIn, checkOut } index.
//
// Populated because the caller names the clashing property in the error, which
// is far more useful than "you are already booked".
function findGuestOverlappingBooking(userId, checkIn, checkOut) {
  return Booking.findOne({ user: userId, ...overlaps(checkIn, checkOut) })
    .populate("listing", "title");
}

// Every occupied range on a listing from today onwards, for the calendar.
// Only the two dates are selected — the calendar needs nothing else, and the
// response is public, so it must not leak who booked what.
async function getBookedRanges(listingId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const rows = await Booking.find({
    listing: listingId,
    status: { $ne: "cancelled" },
    checkOut: { $gt: today },
  })
    .select("checkIn checkOut -_id")
    .sort({ checkIn: 1 })
    .lean();

  return rows.map((r) => ({
    from: r.checkIn.toISOString().slice(0, 10),
    to: r.checkOut.toISOString().slice(0, 10),
  }));
}

module.exports = {
  findOverlappingBooking,
  findGuestOverlappingBooking,
  getBookedRanges,
};
