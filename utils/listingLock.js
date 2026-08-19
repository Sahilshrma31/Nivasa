const crypto = require("crypto");
const redis = require("../config/redis");

// Mutual exclusion around "is this listing free? then take it".
//
// Redis is used rather than an in-process mutex because the app runs in Docker
// and can be scaled to several containers, which each get their own memory.
//
// Note the deliberate difference from the caching code: there, a Redis outage
// falls through to the database, because a slow page is better than no page.
// Here it fails closed. Booking spends the guest's money, and taking payment
// for a room that may already be sold is worse than asking them to retry.

const LOCK_TTL_MS = 5000;

class LockBusyError extends Error {}
class LockUnavailableError extends Error {}

// Release only if this caller still owns the lock. Without the token check a
// slow request whose TTL had already expired would delete the next caller's
// lock on its way out.
const RELEASE = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

async function withListingLock(listingId, fn) {
  if (!redis) throw new LockUnavailableError("Booking is temporarily unavailable.");

  const key = `lock:booking:${listingId}`;
  const token = crypto.randomUUID();

  let acquired;
  try {
    acquired = await redis.set(key, token, "NX", "PX", LOCK_TTL_MS);
  } catch (err) {
    throw new LockUnavailableError("Booking is temporarily unavailable.");
  }

  if (!acquired) throw new LockBusyError("Someone else is booking these dates. Please try again.");

  try {
    return await fn();
  } finally {
    try {
      await redis.eval(RELEASE, 1, key, token);
    } catch {
      // Nothing to do — the TTL will clear it.
    }
  }
}

module.exports = { withListingLock, LockBusyError, LockUnavailableError, LOCK_TTL_MS };
