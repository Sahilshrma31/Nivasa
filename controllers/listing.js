const Listing = require("../models/listing");
const Booking = require("../models/booking");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const redis = require("../config/redis");
const { generateSmartDescription } = require("../utils/aiDescriptionHelper");

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("../config/s3");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

/* Show all listings */
module.exports.index = async (req, res) => {
  const startTime = Date.now();

  try {
    const { search, minPrice, maxPrice, sort } = req.query;

    const hasQuery = search || minPrice || maxPrice || sort;

    let allListings;

    // CASE 1: SEARCH / SORT / FILTER → ALWAYS DB
    if (hasQuery) {
      let query = {};

      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
      }

      let dbQuery = Listing.find(query);

      if (sort === "priceLowToHigh") {
        dbQuery = dbQuery.sort({ price: 1 });
      } else if (sort === "priceHighToLow") {
        dbQuery = dbQuery.sort({ price: -1 });
      }

      allListings = await dbQuery;
    }

    // CASE 2: SIMPLE LISTING PAGE → TRY REDIS
    else {
      const CACHE_KEY = "listings:all";

      if (redis) {
        try {
          const cachedListings = await redis.get(CACHE_KEY);
          if (cachedListings) {
            allListings = JSON.parse(cachedListings);
          }
        } catch (err) {
          console.log("Redis read failed, using DB");
        }
      }

      if (!allListings) {
        allListings = await Listing.find({});

        if (redis) {
          try {
            await redis.set(CACHE_KEY, JSON.stringify(allListings), "EX", 60);
          } catch (err) {
            console.log("Redis write skipped");
          }
        }
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
      query: search || "",
      minPrice: minPrice || "",
      maxPrice: maxPrice || "",
      sort: sort || ""
    });

  } catch (err) {
    console.error("Index error:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/listings");
  } finally {
    console.log("Listings response time:", Date.now() - startTime, "ms");
  }
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
      const key = Date.now() + "-" + req.file.originalname;

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      };

      await s3.send(new PutObjectCommand(params));

      const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      listingData.image = {
        url: imageUrl,
        filename: key
      };
    }

    const location = listingData.location;
    const GEO_CACHE_KEY = `geo:${location.toLowerCase()}`;
    let geoData = null;

    if (redis) {
      try {
        const cachedGeo = await redis.get(GEO_CACHE_KEY);
        if (cachedGeo) geoData = JSON.parse(cachedGeo);
      } catch (err) {
        console.log("Redis geo cache read failed");
      }
    }

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
        try {
          await redis.set(GEO_CACHE_KEY, JSON.stringify(geoData), "EX", 86400);
        } catch (err) {
          console.log("Redis geo cache write skipped");
        }
      }
    }

    const newListing = new Listing(listingData);
    newListing.owner = req.user._id;
    newListing.geometry = geoData.geometry;

    await newListing.save();

    if (redis) {
      try {
        await redis.del("listings:all");
      } catch {}
    }

    req.flash("success", "New listing created successfully.");
    res.redirect("/listings");

  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong.");
    res.redirect("/listings/new");
  }
};


/* Show single listing */
module.exports.showListing = async (req, res) => {
  const startTime = Date.now();

  try {
    const listingId = req.params.id;
    const CACHE_KEY = `listing:${listingId}`;
    let listing = null;

    if (redis) {
      try {
        const cachedListing = await redis.get(CACHE_KEY);
        if (cachedListing) {
          listing = JSON.parse(cachedListing);
        }
      } catch {
        console.log("Redis read failed for listing");
      }
    }

    if (!listing) {
      listing = await Listing.findById(listingId)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");

      if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
      }

      if (redis) {
        try {
          await redis.set(CACHE_KEY, JSON.stringify(listing), "EX", 60);
        } catch {}
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

  } catch (err) {
    console.error("ShowListing error:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/listings");
  } finally {
    console.log("Single listing response time:", Date.now() - startTime, "ms");
  }
};


module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const listingData = req.body.listing;

  if (req.file) {
    const key = Date.now() + "-" + req.file.originalname;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    };

    await s3.send(new PutObjectCommand(params));

    const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    listingData.image = {
      url: imageUrl,
      filename: key
    };
  }

  await Listing.findByIdAndUpdate(id, listingData);

  req.flash("success", "Listing updated successfully.");
  res.redirect(`/listings/${id}`);
};


/* Render new listing form */
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs", {
    query: "",
    minPrice: "",
    maxPrice: "",
    sort: ""
  });
};


/* Delete listing */
module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;

  await Listing.findByIdAndDelete(id);

  if (redis) {
    try {
      await redis.del("listings:all");
      await redis.del(`listing:${id}`);
    } catch {}
  }

  req.flash("success", "Listing deleted.");
  res.redirect("/listings");
};