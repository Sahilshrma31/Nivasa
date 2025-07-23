const Listing = require("./models/listing.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const ExpressError = require("./utils/ExpressError");
const Review = require("./models/review.js");

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
    if (!listing.owner.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the owner of this listing!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

// Middleware to validate listing data using Joi schema
module.exports.validateListing = async (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

// Middleware to validate review data using Joi schema
module.exports.validatereview = async (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

// Middleware to check if the logged-in user is the author of the review
module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review.author.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the author of this review!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};
