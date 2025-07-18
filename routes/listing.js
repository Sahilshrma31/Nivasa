const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const multer = require("multer");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listing");
const mongoose = require("mongoose");
const {storage}=require("../cloudconfig.js");
const upload = multer({ storage });
// GET all listings / POST new listing
router.route("/")
  .get(wrapAsync(listingController.index)) // show all listings
  .post(
    isLoggedIn, // check if user is logged in
    upload.single("listing[image]"), // handle image upload
    validateListing, // validate listing data
    wrapAsync(listingController.createListing) // create new listing
  );

// show form to create new listing
router.get(
  "/new",
  isLoggedIn,
  wrapAsync(listingController.renderNewForm)
);

// show form to edit a listing
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm)
);

// show, update, or delete a listing
router.route("/:id")
  .get(wrapAsync(listingController.showListing)) // show listing details
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"), // handle image update
    validateListing,
    wrapAsync(listingController.updateListing) // update listing
  )
  .delete(
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.destroyListing) // delete listing
  );

module.exports = router;
