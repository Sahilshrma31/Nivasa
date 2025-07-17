const express = require("express");
const router = express.Router({ mergeParams: true }); 
// If you're using nested routes (e.g., mounting this router on /listings/:id/reviews), mergeParams: true ensures that :id from the parent route (/listings/:id) is available inside this router using req.params.id.
// Without mergeParams: true, req.params.id would be undefined in nested routers.

const wrapAsync = require("../utils/wrapAsync.js");
const { reviewSchema } = require("../schema.js");
const ExpressError = require("../utils/ExpressError");
const Review = require("../models/review.js");
const Listing = require("../models/listing.js");

const validatereview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, err);
    } else {
        next();
    }
}

// reviews route
// post review request
router.post(
    "/",
    validatereview,
    wrapAsync(async (req, res) => { // Review form submit hone par yeh route chalega
        let listing = await Listing.findById(req.params.id); // URL se listing ka ID leke usse DB se dhoond rahe hain
        let newReview = new Review(req.body.review); // Form se jo review aaya uska ek naya object bana rahe hain
        listing.reviews.push(newReview); // Listing ke reviews array mein naya review daal rahe hain (reference)

        await newReview.save(); // Review ko database mein save kar rahe hain
        await listing.save(); // Listing mein jo review add kiya tha, usko bhi DB mein update kar rahe hain

        req.flash("success", "Review added successfully."); // Success flash message
        res.redirect(`/listings/${listing._id}`); // Response bhej rahe hain (redirect bhi kar sakte ho)
    })
);

// delete review route
// DELETE route to delete a review from a listing
router.delete(
    "/:reviewID", // Route for deleting a review
    wrapAsync(async (req, res) => { // Async wrapper to handle errors
        let { id, reviewID } = req.params; // URL se listing ID aur review ID le rahe hain

        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewID } }); // Listing ke reviews array se review ID hata rahe hain
        await Review.findByIdAndDelete(reviewID); // Actual review document ko delete kar rahe hain

        req.flash("success", "Review deleted successfully."); // Success flash message
        res.redirect(`/listings/${id}`); // Wapas listing page par redirect kar rahe hain
    })
);

module.exports = router;
