const Listing = require("./models/listing.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const ExpressError = require("./utils/ExpressError");
const Review = require("./models/review.js");
const redis = require("./config/redis");

// Middleware to check if user is logged in
module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        if (req.method === "GET") {
            req.session.redirectUrl = req.originalUrl;
        } else if (req.method === "POST" || req.method === "DELETE") {
            const { id } = req.params;
            if (id) {
                req.session.redirectUrl = `/listings/${id}`;
            } else {
                req.session.redirectUrl = "/listings";
            }
        }
        req.flash("error", "You must be logged in first!");
        return res.redirect("/login");
    }
    next();
};

// Same check as isLoggedIn, but for endpoints the browser calls with fetch().
// Those callers want a status code they can branch on, not a 302 to /login
// that fetch silently follows and hands back as a 200 page of HTML.
module.exports.isLoggedInApi = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, message: "You must be logged in." });
    }
    next();
};

// Rate limiter backed by Redis rather than process memory. The app runs in
// Docker and can be scaled to several containers; an in-memory counter would
// reset per container and let a caller multiply their quota by the replica count.
// If Redis is unreachable we fail open — a cache outage should slow the app
// down, not lock everyone out.
module.exports.rateLimit = ({ keyPrefix, max, windowSec }) => {
    return async (req, res, next) => {
        if (!redis) return next();

        const caller = req.user ? req.user._id : req.ip;
        const key = `rl:${keyPrefix}:${caller}`;

        try {
            const hits = await redis.incr(key);
            if (hits === 1) await redis.expire(key, windowSec); // start the window on first hit
            if (hits > max) {
                return res.status(429).json({
                    success: false,
                    message: "Too many requests. Please try again later."
                });
            }
        } catch (err) {
            console.log("Rate limit check skipped, Redis unavailable");
        }
        next();
    };
};

// Middleware to save the redirect URL after login
module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirect = req.session.redirectUrl;
    }
    next();
};

// Middleware to check if the logged-in user is the owner of the listing
module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    // A stale bookmark or a deleted listing used to reach `listing.owner` on
    // null here and take the whole request down with a 500.
    if (!listing) {
        req.flash("error", "That listing no longer exists.");
        return res.redirect("/listings");
    }
    if (!listing.owner.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the owner of this listing!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

// Middleware to validate listing data using Joi schema
module.exports.validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        return next(new ExpressError(400, errMsg)); 
    }
    next();
};

// Middleware to validate review data using Joi schema
module.exports.validatereview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        return next(new ExpressError(400, errMsg)); 
    }
    next();
};

// Middleware to check if the logged-in user is the author of the review
module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review) {
        req.flash("error", "That review no longer exists.");
        return res.redirect(`/listings/${id}`);
    }
    if (!review.author.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the author of this review!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};
