// Bookings are whole-day, so every date is normalised to UTC midnight. Doing
// this in one place keeps the order and the booking from disagreeing about
// what "2026-09-01" means when the server and the guest are in different zones.

const MS_PER_NIGHT = 24 * 60 * 60 * 1000;
const MAX_NIGHTS = 365;

class StayDateError extends Error {}

function toUtcMidnight(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Returns { checkIn, checkOut, nights } or throws StayDateError with a message
// that is safe to show the guest.
function parseStay(checkInInput, checkOutInput) {
  if (!checkInInput || !checkOutInput) {
    throw new StayDateError("Both check-in and check-out dates are required.");
  }

  const checkIn = toUtcMidnight(checkInInput);
  const checkOut = toUtcMidnight(checkOutInput);

  if (!checkIn || !checkOut) throw new StayDateError("Those dates are not valid.");

  const nights = Math.round((checkOut - checkIn) / MS_PER_NIGHT);

  if (nights < 1) throw new StayDateError("Check-out must be at least one night after check-in.");
  if (nights > MAX_NIGHTS) throw new StayDateError(`A stay cannot exceed ${MAX_NIGHTS} nights.`);

  const today = toUtcMidnight(new Date());
  if (checkIn < today) throw new StayDateError("Check-in cannot be in the past.");

  return { checkIn, checkOut, nights };
}

module.exports = { parseStay, toUtcMidnight, StayDateError, MAX_NIGHTS };
