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
    throw new ExpressError(400, error);
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
    const listing = await Listing.findById(id).populate("reviews");
    if (!listing) {
      req.flash("error", "Listing you requested for does not exist");
      return res.redirect("/listings");
    }
  
    res.render("listings/show.ejs", { listing });
  }));
  

// Create
router.post(
  "/",
  isLoggedIn,
  upload.single("listing[image]"),
  validateListing,
  wrapAsync(async (req, res) => {
    const listingData = req.body.listing;

    if (req.file) {
      listingData.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }

    const newListing = new Listing(listingData);
    await newListing.save();

    req.flash("success", "New listing created successfully.");
    res.redirect(`/listings`);
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
