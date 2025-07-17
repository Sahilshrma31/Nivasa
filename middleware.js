const Listing=require("./models/listing.js");
const { listingSchema,reviewSchema } = require("./schema.js");
const ExpressError = require("./utils/ExpressError");
const Review = require("./models/review.js");
module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) { // Agar user login nahi hai toh check karo
      if (req.method === "GET") { // Agar request GET hai (matlab page open kar raha hai)
        req.session.redirectUrl = req.originalUrl; // Original URL ko session mein store karo, login ke baad yahin redirect karenge
      } else if (req.method === "POST" || req.method === "DELETE") { // Agar POST ya DELETE request hai
        const { id } = req.params; // URL se listing ka id nikaal rahe hain
        if (id) {
          req.session.redirectUrl = `/listings/${id}`; // Listing detail page ko redirect URL bana lo
        } else {
          req.session.redirectUrl = "/listings"; // Agar id nahi mili toh fallback /listings pe redirect karo
        }
      }
  
      req.flash("error", "You must be logged in first!"); // Flash message dikhayein ki login karna zaroori hai
      return res.redirect("/login"); // Login page pe redirect karo
    }
    next(); // Agar login hai toh aage badho
};

  

module.exports.saveRedirectUrl=(req,res,next)=>{  
    // redirecting users back to the page they were trying to access after they log in. It improves UX by avoiding sending them to a static page like /dashboard every time.
    if(req.session.redirectUrl){
        res.locals.redirect=req.session.redirectUrl;
    }
    next();
}

module.exports.isOwner=async(req,res,next)=>{
    let { id } = req.params;
    let listing=await Listing.findById(id);
    // It checks if the logged-in user is the owner of the listing before allowing them to edit it.
    if(!listing.owner.equals(res.locals.currUser._id)){
        req.flash("error","You are not the owner of this listing! ");
        return res.redirect(`/listings/${id}`);
      }
      next();
}

module.exports.validateListing=async(req,res,next)=>{
        let { error } = listingSchema.validate(req.body);
        if (error) {
          let errMsg = error.details.map((el) => el.message).join(",");
          throw new ExpressError(400, errMsg);
        } else {
          next();
        }
    
}

module.exports.validatereview=async(req,res,next)=>{
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
}

module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review.author.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the author of this review!");
        return res.redirect(`/listings/${id}`);
    }
    next();
};