const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const {isLoggedIn,isOwner,validateListing}=require("../middleware.js");
const listingController = require("../controllers/listing");
const mongoose = require("mongoose");

// Index
router.get("/", wrapAsync(listingController.index));

// New form
router.get("/new", 
    isLoggedIn,
    wrapAsync(listingController.renderNewForm));

// Show
router.get("/:id", wrapAsync(listingController.showListing));

// Create
router.post(
  "/", 
  isLoggedIn, //ye middleware ensure karta hai ki user login hai
  upload.single("listing[image]"), //image upload ke liye multer middleware
  validateListing, //ye function form data validate karta hai schema ke against
  wrapAsync(listingController.createListing)
);


// Edit form
router.get("/:id/edit",
     isLoggedIn,
     isOwner,
    wrapAsync());
  

// Update
router.put(
  "/:id",
  isLoggedIn,
  isOwner,
  upload.single("listing[image]"),
  validateListing,
  wrapAsync(listingController.updateListing)
);

// Delete
router.delete("/:id",
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.destroyListing));

module.exports = router;
