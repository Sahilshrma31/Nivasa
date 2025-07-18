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
