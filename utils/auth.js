const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const redis = require("../config/redis");

// Login state is a signed JWT instead of a server-side session. The token
// carries the user id, so any container can verify it with the secret alone,
// with no session store to share.
//
// It travels in an httpOnly cookie rather than localStorage: page scripts
// cannot read it, so an XSS bug cannot steal it, and the browser sends it with
// every page load and form post the way it sent the session cookie.

const COOKIE = "token";
const TTL_SEC = 7 * 24 * 60 * 60; // 7 days, same as the old session cookie

// JWT_SECRET when set; falls back to the old session SECRET so an existing
// deployment keeps working before the new variable is added.
function secret() {
  const s = process.env.JWT_SECRET || process.env.SECRET;
  if (!s) throw new Error("JWT_SECRET (or SECRET) must be set");
  return s;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax", // not sent on cross-site POSTs, which blocks CSRF form posts
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// Called after a successful login or signup.
function issueToken(res, user) {
  const token = jwt.sign(
    { sub: user._id.toString() },
    secret(),
    {
      expiresIn: TTL_SEC,
      jwtid: crypto.randomUUID(), // lets logout revoke this one token
      algorithm: "HS256",
    }
  );

  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: TTL_SEC * 1000 });
}

const revokedKey = (jti) => `jwt:revoked:${jti}`;

// A JWT stays valid until it expires, so clearing the cookie alone would leave
// a copied token usable for up to a week. Logout records the token id in Redis
// until the moment it would have expired anyway, and authenticate() rejects it.
async function revokeToken(req, res) {
  const token = req.cookies && req.cookies[COOKIE];
  res.clearCookie(COOKIE, cookieOptions);
  if (!token || !redis) return;

  try {
    const { jti, exp } = jwt.verify(token, secret(), { algorithms: ["HS256"] });
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (jti && ttl > 0) await redis.set(revokedKey(jti), "1", "EX", ttl);
  } catch {
    // Already invalid or expired: nothing left to revoke.
  }
}

// Runs on every request. Sets req.user when the cookie holds a valid,
// unrevoked token for a user that still exists; otherwise leaves it null.
async function authenticate(req, res, next) {
  req.user = null;
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return next();

  try {
    const { sub, jti } = jwt.verify(token, secret(), { algorithms: ["HS256"] });

    // Fails open: if Redis is down a revoked token works until it expires.
    // The cookie is already gone from the browser that logged out, so this
    // only matters for a stolen copy, and taking the whole site down for
    // every logged-in user would be the worse outcome.
    if (redis && jti) {
      try {
        if (await redis.exists(revokedKey(jti))) throw new Error("revoked");
      } catch (err) {
        if (err.message === "revoked") throw err;
      }
    }

    // Looked up each time so a deleted account stops working immediately and
    // req.user is a full document, as passport used to provide.
    req.user = await User.findById(sub);
    if (!req.user) res.clearCookie(COOKIE, cookieOptions);
  } catch {
    // Bad signature, expired or revoked: treat as logged out.
    res.clearCookie(COOKIE, cookieOptions);
  }

  next();
}

module.exports = { issueToken, revokeToken, authenticate };
