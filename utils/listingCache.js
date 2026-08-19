const redis = require("./../config/redis");

// The listings grid is now paginated, so the index is spread over one cache
// entry per page instead of a single "listings:all" blob. Deleting them by
// name on every write would mean scanning the keyspace, which is exactly the
// operation Redis asks you not to run against a live server.
//
// Instead every key carries a version number. Bumping the counter makes all
// existing keys unreachable in one atomic write, and the stranded entries fall
// off on their own TTL.

const VERSION_KEY = "listings:ver";

async function currentVersion() {
  if (!redis) return null;
  try {
    return (await redis.get(VERSION_KEY)) || "0";
  } catch {
    return null; // treated as a cache miss by callers
  }
}

async function bumpVersion() {
  if (!redis) return;
  try {
    await redis.incr(VERSION_KEY);
  } catch {
    console.log("Redis version bump skipped");
  }
}

function pageKey(version, page) {
  return `listings:v${version}:page:${page}`;
}

module.exports = { currentVersion, bumpVersion, pageKey };
