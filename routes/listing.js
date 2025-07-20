const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const multer = require("multer");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listing");
const mongoose = require("mongoose");
const { storage } = require("../cloudconfig.js");
const upload = multer({ storage });

// Add this line at the top — after imports
router.use((req, res, next) => {
  console.log("Inside Listing Router — Current User:", req.user ? req.user.username : "Not logged in");
  next();
});


// Show all listings and handle new listing creation
router.route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );

// Show form to create a new listing
router.get("/new", isLoggedIn, wrapAsync(listingController.renderNewForm));

// Search listings based on query
// This MUST come before the dynamic ":id" route to avoid conflict
router.get("/search", wrapAsync(listingController.searchListings));

// Show form to edit a specific listing
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));

router.post("/generate-description", wrapAsync(async (req, res) => {
  const { title, location, price } = req.body;

  if (!title || !location || !price) {
    return res.status(400).json({ error: "Missing data for description generation" });
  }

  const description = `Discover our listing: ${title} located in ${location}. Enjoy your stay for just ₹${price} per night. Ideal for travelers looking for comfort and convenience.`;

  res.json({ description });
}));


// Show, update, or delete a specific listing
router.route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.updateListing)
  )
  .delete(
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.destroyListing)
  );




module.exports = router;
