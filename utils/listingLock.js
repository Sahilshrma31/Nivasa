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

async function acquire(key) {
  const token = crypto.randomUUID();

  let acquired;
  try {
    acquired = await redis.set(key, token, "NX", "PX", LOCK_TTL_MS);
  } catch (err) {
    throw new LockUnavailableError("Booking is temporarily unavailable.");
  }

  if (!acquired) throw new LockBusyError("Someone else is booking these dates. Please try again.");
  return token;
}

async function release(key, token) {
  try {
    await redis.eval(RELEASE, 1, key, token);
  } catch {
    // Nothing to do — the TTL will clear it.
  }
}

// Hold several locks for one critical section.
//
// Confirming a booking asks two different questions: "is this listing free on
// these dates?" and "is this guest already staying somewhere else then?". The
// first is guarded by a lock on the listing, the second by a lock on the user,
// and both answers have to stay true until the booking row exists.
//
// Keys are sorted before acquiring. Two requests that want the same pair of
// locks therefore always take them in the same order, which is what stops
// request A holding the listing while B holds the user and neither can finish.
async function withLocks(keys, fn) {
  if (!redis) throw new LockUnavailableError("Booking is temporarily unavailable.");

  const ordered = [...new Set(keys)].sort();
  const held = [];

  try {
    for (const key of ordered) {
      held.push([key, await acquire(key)]);
    }
    return await fn();
  } finally {
    // Reverse order, so the lock taken last is given back first.
    for (const [key, token] of held.reverse()) {
      await release(key, token);
    }
  }
}

const listingKey = (listingId) => `lock:booking:${listingId}`;
const userKey = (userId) => `lock:guest:${userId}`;

function withListingLock(listingId, fn) {
  return withLocks([listingKey(listingId)], fn);
}

// Used by the booking confirm, which must hold both.
function withStayLock(listingId, userId, fn) {
  return withLocks([listingKey(listingId), userKey(userId)], fn);
}

module.exports = {
  withListingLock,
  withStayLock,
  withLocks,
  LockBusyError,
  LockUnavailableError,
  LOCK_TTL_MS,
};
