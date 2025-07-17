const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { listingSchema } = require("../schema.js");
const ExpressError = require("../utils/ExpressError");
const Listing = require("../models/listing.js");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const {isLoggedIn}=require("../middleware.js");

// Validation middleware
const validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, err);
  } else {
    next();
  }
};

// Index
router.get("/", wrapAsync(async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
}));

// New form
router.get("/new", 
    isLoggedIn,
    wrapAsync(async (req, res) => {
  res.render("listings/new.ejs");
}));

// Show
router.get("/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
    .populate("reviews")
    .populate("owner");
    if (!listing) {
      req.flash("error", "Listing you requested for does not exist");
      return res.redirect("/listings");
    }
    // console.log(listing);
    res.render("listings/show.ejs", { listing });
  }));
  

// Create
router.post(
  "/", 
  isLoggedIn, //ye middleware ensure karta hai ki user login hai
  upload.single("listing[image]"), //image upload ke liye multer middleware
  validateListing, //ye function form data validate karta hai schema ke against
  wrapAsync(async (req, res) => { //error handle karne ke liye async function wrapAsync se wrapped hai
    const listingData = req.body.listing; //form se aaya hua listing data extract kar rahe hain

    if (req.file) { //agar koi file upload hui hai
      listingData.image = {
        url: req.file.path, //image ka path save kar rahe hain
        filename: req.file.filename, //image ka filename save kar rahe hain
      };
    }

    const newListing = new Listing(listingData); //listingData ke basis pe naya Listing object banaya
    newListing.owner=req.user._id; //current logged in user ko as owner assign kiya
    await newListing.save(); //listing ko database me save kiya

    req.flash("success", "New listing created successfully."); //success message flash kiya
    res.redirect(`/listings`); //user ko listings page pe redirect kiya
  })
);


// Edit form
router.get("/:id/edit",
     isLoggedIn,
    wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
      req.flash("error", "Listing you requested for does not exist");
      return res.redirect("/listings");
    }
  
    res.render("listings/edit.ejs", { listing });
  }));
  

// Update
router.put(
  "/:id",
  isLoggedIn,
  upload.single("listing[image]"),
  validateListing,
  wrapAsync(async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    req.flash("success", "Listing updated successfully.");
    res.redirect(`/listings/${id}`);
  })
);

// Delete
router.delete("/:id",
    isLoggedIn,
    wrapAsync(async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);

  req.flash("success", "Listing deleted successfully.");
  res.redirect("/listings");
}));

module.exports = router;
