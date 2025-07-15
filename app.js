const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError");
const {listingSchema,reviewSchema}=require("./schema.js")
const Review=require("./models/review.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/Nivasa";

main()
  .then(() => {
    console.log("connected to db");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const validateListing=(req,res,next)=>{
    let {error}=listingSchema.validate(req.body);
    if(error){
        let errMsg=error.details.map((el)=>el.message).join(",");
        throw new ExpressError(400,error);
    }else{
        next();
        }
}

const validatereview=(req,res,next)=>{
  let {error}=reviewSchema.validate(req.body);
  if(error){
      let errMsg=error.details.map((el)=>el.message).join(",");
      throw new ExpressError(400,error);
  }else{
      next();
      }
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.json());
app.use(express.static(path.join(__dirname, "/public")));

// Index route
app.get(
  "/listings",
  wrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
  })
);

// New route
app.get(
  "/listings/new",
  wrapAsync(async (req, res) => {
    res.render("listings/new.ejs");
  })
);

// Show route
app.get(
  "/listings/:id",
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("reviews");
    res.render("listings/show.ejs", { listing });
  })
);

// Create route
app.post(
  "/listings",
  validateListing,
  wrapAsync(async (req, res,next) => {
    const newListing = new Listing(req.body.listing);
    await newListing.save();
    res.redirect("/listings");
  })
);

// Edit route
app.get(
  "/listings/:id/edit",
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/edit.ejs", { listing });
  })
);

// Update route
app.put(
  "/listings/:id",
  validateListing,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    res.redirect(`/listings/${id}`);
  })
);

// Delete route
app.delete(
  "/listings/:id",
  wrapAsync(async (req, res) => {
    await Listing.findByIdAndDelete(req.params.id);
    res.redirect("/listings");
  })
);

//reviews route

//post review  request
app.post("/listings/:id/reviews",
  validatereview, wrapAsync(async (req, res) => { // Review form submit hone par yeh route chalega
  let listing = await Listing.findById(req.params.id); // URL se listing ka ID leke usse DB se dhoond rahe hain
  let newReview = new Review(req.body.review); // Form se jo review aaya uska ek naya object bana rahe hain
  listing.reviews.push(newReview);// Listing ke reviews array mein naya review daal rahe hain (reference)

  await newReview.save(); // Review ko database mein save kar rahe hain
  await listing.save(); // Listing mein jo review add kiya tha, usko bhi DB mein update kar rahe hain

  console.log("new review saved"); 

  res.redirect(`/listings/${listing._id}`); // Response bhej rahe hain (redirect bhi kar sakte ho)
}));

//delete review route
// DELETE route to delete a review from a listing
app.delete("/listings/:id/reviews/:reviewID",  //  Route for deleting a review
  wrapAsync(async (req, res) => {  // Async wrapper to handle errors
    let { id, reviewID } = req.params;  //  URL se listing ID aur review ID le rahe hain

    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewID } });  // Listing ke reviews array se review ID hata rahe hain

    await Review.findByIdAndDelete(reviewID);  // Actual review document ko delete kar rahe hain

    res.redirect(`/listings/${id}`);  // Wapas listing page par redirect kar rahe hain
}));



// Test route
app.get(
  "/testListing",
  wrapAsync(async (req, res) => {
    let sampleListing = new Listing({
      title: "my new villa",
      description: "by the beach",
      price: 1200,
      location: "Calangute, Goa",
      country: "India",
    });
    await sampleListing.save();
    console.log("sample was saved");
    res.send("successfully tested");
  })
);

// Home route
app.get("/", (req, res) => {
  res.send("welcome to nivasa");
});

// Catch-all route
// app.all("*", (req, res, next) => {
//   next(new ExpressError(404, "Page not found!"));
// });

// 404 handler (no app.all needed)
app.use((req, res, next) => {
    next(new ExpressError("Page Not Found", 404));
  });

  
// Error handling middleware
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs",{message});
});


  
app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});
