const Redis = require("ioredis");

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    enableOfflineQueue: false,   // stop queue retry
    maxRetriesPerRequest: 1,     // stop infinite retry
    retryStrategy(times) {
      if (times > 1) return null; // HARD STOP
      return 1000;
    },
  });

  redis.on("connect", () => {
    console.log("Redis connected");
  });

  redis.on("error", (err) => {
    console.error(" Redis error:", err.message);
  });
} else {
  console.log("REDIS_URL not found. Redis disabled.");
}

module.exports = redis;
