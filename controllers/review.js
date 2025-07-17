const Listing=require("../models/listing");
const Review=require("../models/review");
const mongoose = require('mongoose');


module.exports.createReview=async (req, res) => { // Review form submit hone par yeh route chalega
    let listing = await Listing.findById(req.params.id); // URL se listing ka ID leke usse DB se dhoond rahe hain
    let newReview = new Review(req.body.review); // Form se jo review aaya uska ek naya object bana rahe hain
    listing.reviews.push(newReview); // Listing ke reviews array mein naya review daal rahe hain (reference)
    newReview.author=req.user._id;
    await newReview.save(); // Review ko database mein save kar rahe hain
    await listing.save(); // Listing mein jo review add kiya tha, usko bhi DB mein update kar rahe hain

    req.flash("success", "Review added successfully."); // Success flash message
    res.redirect(`/listings/${listing._id}`); // Response bhej rahe hain (redirect bhi kar sakte ho)
}

module.exports.destroyReview=async (req, res) => { // Async wrapper to handle errors
    let { id, reviewId } = req.params; // URL se listing ID aur review ID le rahe hain

    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } }); // Listing ke reviews array se review ID hata rahe hain
    await Review.findByIdAndDelete(reviewId); // Actual review document ko delete kar rahe hain

    req.flash("success", "Review deleted successfully."); // Success flash message
    res.redirect(`/listings/${id}`); // Wapas listing page par redirect kar rahe hain

}