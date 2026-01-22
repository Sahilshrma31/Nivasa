const Listing = require("../models/listing");
const Review = require("../models/review");
const mongoose = require('mongoose');
const redis = require("../config/redis");


// Create and add a new review to a listing
module.exports.createReview = async (req, res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    listing.reviews.push(newReview);
    newReview.author = req.user._id;
    await newReview.save();
    await listing.save();

// CLEAR REDIS CACHE
    if (redis) {
     await redis.del(`listing:${listing._id}`);
        }

        req.flash("success", "Review added successfully.");
        res.redirect(`/listings/${listing._id}`);

};

// Delete a review from a listing
module.exports.destroyReview = async (req, res) => {
    const { id, reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
        req.flash("error", "Review not found");
        return res.redirect(`/listings/${id}`);
    }

    await Listing.findByIdAndUpdate(id, {
        $pull: { reviews: reviewId }
    });

   await Review.findByIdAndDelete(reviewId);

//  CLEAR REDIS CACHE
    if (redis) {
     await redis.del(`listing:${id}`);
    }

    req.flash("success", "Review deleted successfully.");
    res.redirect(`/listings/${id}`);

    };

