const Listing = require("../models/listing");
const Booking = require("../models/booking");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const redis = require("../config/redis");
const { generateSmartDescription } = require("../utils/aiDescriptionHelper");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

/* Show all listings */
module.exports.index = async (req, res) => {
  const startTime = Date.now();

  try {
    const CACHE_KEY = "listings:all";
    let allListings = null;

    // Try cache
    if (redis) {
      const cachedListings = await redis.get(CACHE_KEY);
      if (cachedListings) {
        allListings = JSON.parse(cachedListings);
      }
    }

    // Fallback to database
    if (!allListings) {
      allListings = await Listing.find({});
      if (redis) {
        await redis.set(CACHE_KEY, JSON.stringify(allListings), "EX", 60);
      }
    }

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
  } finally {
    console.log("Listings response time:", Date.now() - startTime, "ms");
  }
};

/* Render new listing form */
module.exports.renderNewForm = async (req, res) => {
  res.render("listings/new.ejs");
};

/* Create new listing */
module.exports.createListing = async (req, res) => {
  try {
    const listingData = req.body.listing;

    if (!listingData.description || listingData.description.trim() === "") {
      listingData.description = await generateSmartDescription(
        listingData.title,
        listingData.location,
        listingData.country,
        listingData.price
      );
    }

    if (req.file) {
      listingData.image = {
        url: req.file.path,
        filename: req.file.filename
      };
    }

    const location = listingData.location;
    const GEO_CACHE_KEY = `geo:${location.toLowerCase()}`;
    let geoData = null;

    // Try geocoding cache
    if (redis) {
      const cachedGeo = await redis.get(GEO_CACHE_KEY);
      if (cachedGeo) {
        geoData = JSON.parse(cachedGeo);
      }
    }

    // Fallback to Mapbox
    if (!geoData) {
      const geoResponse = await geocodingClient
        .forwardGeocode({ query: location, limit: 1 })
        .send();

      geoData = geoResponse.body.features[0];

      if (!geoData) {
        req.flash("error", "Invalid location.");
        return res.redirect("/listings/new");
      }

      if (redis) {
        await redis.set(GEO_CACHE_KEY, JSON.stringify(geoData), "EX", 86400);
      }
    }

    const newListing = new Listing(listingData);
    newListing.owner = req.user._id;
    newListing.geometry = geoData.geometry;
    await newListing.save();

    if (redis) {
      await redis.del("listings:all");
    }

    req.flash("success", "New listing created successfully.");
    res.redirect("/listings");
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong.");
    res.redirect("/listings/new");
  }
};

/* Render edit form */
module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  let originalImageUrl = listing.image.url.replace("/upload", "/upload/w_250");

  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

/* Update listing */
module.exports.updateListing = async (req, res) => {
  const { id } = req.params;

  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

  if (req.file) {
    listing.image = {
      url: req.file.path,
      filename: req.file.filename
    };
    await listing.save();
  }

  if (redis) {
    await redis.del("listings:all");
    await redis.del(`listing:${id}`);
  }

  req.flash("success", "Listing updated.");
  res.redirect(`/listings/${id}`);
};

/* Show single listing */
module.exports.showListing = async (req, res) => {
  const startTime = Date.now();

  try {
    const listingId = req.params.id;
    const CACHE_KEY = `listing:${listingId}`;
    let listing = null;

    // Try cache
    if (redis) {
      const cachedListing = await redis.get(CACHE_KEY);
      if (cachedListing) {
        listing = JSON.parse(cachedListing);
      }
    }

    // Fallback to database
    if (!listing) {
      listing = await Listing.findById(listingId)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");

      if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
      }

      if (redis) {
        await redis.set(CACHE_KEY, JSON.stringify(listing), "EX", 60);
      }
    }

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
      listing.owner &&
      currUser._id.toString() === listing.owner._id.toString();

    res.render("listings/show", {
      listing,
      currUser,
      isOwner,
      hasBooked,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } finally {
    console.log("Single listing response time:", Date.now() - startTime, "ms");
  }
};

/* Delete listing */
module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;

  await Listing.findByIdAndDelete(id);

  if (redis) {
    await redis.del("listings:all");
    await redis.del(`listing:${id}`);
  }

  req.flash("success", "Listing deleted.");
  res.redirect("/listings");
};
