const Listing = require("../models/listing");
const Booking = require("../models/booking"); 
const mongoose = require("mongoose");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });
const redis=require("../config/redis");




const { generateSmartDescription } = require("../utils/aiDescriptionHelper");


//Show all listings with Redis caching
module.exports.index = async (req, res) => {
  const CACHE_KEY = "listings:all";

  // Try to read listings from Redis cache first
  const cachedListings = await redis.get(CACHE_KEY);

  let allListings;

  if (cachedListings) {
    // Cache hit: parse cached JSON data
    allListings = JSON.parse(cachedListings);
    console.log("Listings served from Redis cache");
  } else {
    // Cache miss: fetch data from MongoDB
    allListings = await Listing.find({});
    console.log("Listings fetched from MongoDB");

    // Store the fetched data in Redis with a TTL of 60 seconds
    await redis.set(CACHE_KEY, JSON.stringify(allListings), "EX", 60);
  }

  // User-specific booking data should never be cached
  let bookedListings = [];
  if (req.user) {
    bookedListings = await Booking.find({ user: req.user._id }).populate("listing");
  }

  res.render("listings/index.ejs", {
    allListings,
    bookedListings,
    currentUser: req.user,
    query: "",
    minPrice: "",
    maxPrice: "",
    sort: ""
  });
};

// Render form for new listing
module.exports.renderNewForm = async (req, res) => {
  res.render("listings/new.ejs");
};

// Create a new listing with Gemini-powered description and cached geocoding
module.exports.createListing = async (req, res) => {
  try {
    const listingData = req.body.listing;

    // Generate smart description if not provided
    if (!listingData.description || listingData.description.trim() === "") {
      listingData.description = await generateSmartDescription(
        listingData.title,
        listingData.location,
        listingData.country,
        listingData.price
      );
    }

    // Handle image upload (if file exists)
    if (req.file) {
      listingData.image = {
        url: req.file.path,
        filename: req.file.filename
      };
    }

    // GEO CODING WITH REDIS CACHE
    const location = listingData.location;
    const GEO_CACHE_KEY = `geo:${location.toLowerCase()}`;

    // Declare geoData ONCE
    let geoData = await redis.get(GEO_CACHE_KEY);

    if (geoData) {
      // Cache hit
      geoData = JSON.parse(geoData);
      console.log("Geocoding data served from Redis cache");
    } else {
      // Cache miss: call Mapbox
      const geoResponse = await geocodingClient.forwardGeocode({
        query: location,
        limit: 1
      }).send();

      geoData = geoResponse.body.features[0];

      if (!geoData) {
        req.flash("error", "Invalid location. Please enter a valid location.");
        return res.redirect("/listings/new");
      }

      // Cache geocoding result for 24 hours
      await redis.set(GEO_CACHE_KEY, JSON.stringify(geoData), "EX", 86400);
      console.log("Geocoding data fetched from Mapbox and cached");
    }
    //  END GEO CODING

    const newListing = new Listing(listingData);
    newListing.owner = req.user._id;
    newListing.geometry = geoData.geometry;

    await newListing.save();

    // Invalidate listings cache after creating a new listing
    await redis.del("listings:all");

    req.flash("success", "New listing created successfully.");
    res.redirect("/listings");
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

  // Invalidate listings cache after updating a listing
    await redis.del("listings:all");


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


// Show a specific listing with Redis caching
module.exports.showListing = async (req, res) => {
  const listingId = req.params.id;
  const CACHE_KEY = `listing:${listingId}`;

  // Try to get listing from Redis cache
  const cachedListing = await redis.get(CACHE_KEY);

  let listing;

  if (cachedListing) {
    // Cache hit: parse cached listing data
    listing = JSON.parse(cachedListing);
    console.log("Listing served from Redis cache");
  } else {
    // Cache miss: fetch listing from MongoDB
    listing = await Listing.findById(listingId)
      .populate({ path: "reviews", populate: { path: "author" } })
      .populate("owner");

    if (!listing) {
      req.flash("error", "Listing not found");
      return res.redirect("/listings");
    }

    console.log("Listing fetched from MongoDB");

    // Store listing in Redis with TTL of 60 seconds
    await redis.set(CACHE_KEY, JSON.stringify(listing), "EX", 60);
  }

  // User-specific logic (never cached)
  const currUser = req.user;
  let hasBooked = false;

  if (currUser) {
    const booking = await Booking.findOne({
      listing: listing._id,
      user: currUser._id
    });
    if (booking) hasBooked = true;
  }

  const isOwner =
    currUser &&
    currUser._id &&
    listing.owner &&
    listing.owner._id &&
    currUser._id.toString() === listing.owner._id.toString();

  res.render("listings/show", {
    listing,
    currUser,
    isOwner,
    hasBooked,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID
  });
};





// Delete listing
module.exports.destroyListing = async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);

  // Invalidate listings cache
  await redis.del("listings:all"); 

  req.flash("success", "Listing deleted successfully.");
  res.redirect("/listings");
};
