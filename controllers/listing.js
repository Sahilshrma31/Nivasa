const Listing = require("../models/listing");
const Booking = require("../models/booking"); // ✅ Added this line
const mongoose = require("mongoose");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });
require('dotenv').config();


const { generateSmartDescription } = require("../utils/aiDescriptionHelper");

// Show all listings
module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});

  let bookedListings = [];
  if (req.user) {
    bookedListings = await Booking.find({ user: req.user._id }).populate("listing");
  }

  res.render("listings/index.ejs", {
    allListings,
    bookedListings,
    currentUser: req.user,
    query: '',
    minPrice: '',
    maxPrice: '',
    sort: ''
  });
};

// Render form for new listing
module.exports.renderNewForm = async (req, res) => {
  res.render("listings/new.ejs");
};

// Create a new listing with Gemini-powered description
module.exports.createListing = async (req, res) => {
  try {
    const geoResponse = await geocodingClient.forwardGeocode({
      query: req.body.listing.location,
      limit: 1,
    }).send();

    const listingData = req.body.listing;

    // Generate smart description if not provided
    if (!listingData.description || listingData.description.trim() === "") {
      listingData.description = await generateSmartDescription(
        listingData.title,
        listingData.location,
        listingData.price
      );
    }

    // Handle image upload (if file exists)
    if (req.file) {
      listingData.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }

    const newListing = new Listing(listingData);
    newListing.owner = req.user._id;

    const geoData = geoResponse.body.features[0];

    if (!geoData) {
      req.flash("error", "Invalid location. Please enter a valid location.");
      return res.redirect("/listings/new");
    }

    newListing.geometry = geoData.geometry;

    await newListing.save();
    req.flash("success", "New listing created successfully.");
    res.redirect(`/listings`);
  } catch (err) {
    console.error("Error creating listing:", err);
    req.flash("error", "Something went wrong while creating the listing.");
    res.redirect("/listings/new");
  }
};

// Render edit form
module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist");
    return res.redirect("/listings");
  }

  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");

  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

// Update listing
module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

  if (typeof req.file !== "undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = { url, filename };
    await listing.save();
  }

  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

// Search listings with filters and booked data
module.exports.searchListings = async (req, res) => {
  const { q, minPrice, maxPrice, sort } = req.query;

  let filter = {};

  // Keyword filtering
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } },
    ];
  }

  // Price filtering
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseInt(minPrice);
    if (maxPrice) filter.price.$lte = parseInt(maxPrice);
  }

  // Fetch listings based on filter
  let queryObj = Listing.find(filter);

  // Sorting logic
  if (sort === "asc") queryObj = queryObj.sort({ price: 1 });
  if (sort === "desc") queryObj = queryObj.sort({ price: -1 });

  const allListings = await queryObj.exec();

  let bookedListings = [];
  if (req.user) {
    bookedListings = await Booking.find({ user: req.user._id }).populate("listing");
  }

  res.render("listings/index", {
    allListings,
    bookedListings,
    currentUser: req.user,
    query: q || '',
    minPrice: minPrice || '',
    maxPrice: maxPrice || '',
    sort: sort || ''
  });
};

// Show a specific listing


module.exports.showListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  const currUser = req.user;
  let hasBooked = false;

  if (currUser) {
    const booking = await Booking.findOne({ listing: listing._id, user: currUser._id });
    if (booking) hasBooked = true;
  }

  const isOwner = currUser && currUser._id && listing.owner._id &&
    currUser._id.toString() === listing.owner._id.toString();

  res.render("listings/show", {
    listing,
    currUser,
    isOwner,
    hasBooked,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  });
};




// Delete listing
module.exports.destroyListing = async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing deleted successfully.");
  res.redirect("/listings");
};
