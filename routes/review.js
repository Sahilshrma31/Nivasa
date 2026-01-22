const express = require("express");
const router = express.Router({ mergeParams: true }); 
// If you're using nested routes (e.g., mounting this router on /listings/:id/reviews), mergeParams: true ensures that :id from the parent route (/listings/:id) is available inside this router using req.params.id.
// Without mergeParams: true, req.params.id would be undefined in nested routers.
const wrapAsync = require("../utils/wrapAsync.js");
const { reviewSchema } = require("../schema.js");
const ExpressError = require("../utils/ExpressError");
const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const {validatereview,isLoggedIn,isReviewAuthor}=require("../middleware.js");
const reviewController=require("../controllers/review");




// reviews route
// post review request
router.post(
  "/",
  isLoggedIn,
  validatereview,
  wrapAsync(reviewController.createReview)
);


// delete review route
// DELETE route to delete a review from a listing
router.delete(
    "/:reviewId", // Route for deleting a review
    isLoggedIn,
    isReviewAuthor,
    wrapAsync(reviewController.destroyReview)
);

module.exports = router;
