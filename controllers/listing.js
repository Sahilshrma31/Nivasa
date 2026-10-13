const Listing = require("../models/listing");
const Booking = require("../models/booking");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const redis = require("../config/redis");
const { currentVersion, bumpVersion, pageKey } = require("../utils/listingCache");
const { generateSmartDescription } = require("../utils/aiDescriptionHelper");

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("../config/s3");

const mongoose = require("mongoose");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

// Place name -> GeoJSON point via Mapbox. A place's coordinates do not move,
// so the answer is cached for a day. Returns null when Mapbox finds nothing.
async function geocodeLocation(location) {
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
    if (!geoData) return null;

    if (redis) {
      try {
        await redis.set(GEO_CACHE_KEY, JSON.stringify(geoData), "EX", 86400);
      } catch (err) {
        console.log("Redis geo cache write skipped");
      }
    }
  }

  return geoData.geometry;
}

/* Stays nearby */
const NEARBY_RADIUS_M = 50 * 1000; // 50 km
const NEARBY_LIMIT = 4;

// $geoNear walks the 2dsphere index outward from this listing's point, so
// results come back closest first with the distance attached (distanceM, in
// metres). It must be the first stage of the pipeline, and aggregate() does
// not cast ids, hence the explicit ObjectId for excluding this listing.
async function findNearbyListings(listing) {
  const coords = listing.geometry && listing.geometry.coordinates;
  if (!coords || coords.length !== 2) return [];

  return Listing.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: coords },
        key: "geometry",
        distanceField: "distanceM",
        maxDistance: NEARBY_RADIUS_M,
        spherical: true,
        query: { _id: { $ne: new mongoose.Types.ObjectId(String(listing._id)) } },
      },
    },
    { $limit: NEARBY_LIMIT },
    { $project: { title: 1, image: 1, location: 1, price: 1, distanceM: 1 } },
  ]);
}

/* Show all listings */
const PAGE_SIZE = 12;

module.exports.index = async (req, res) => {
  const startTime = Date.now();

  try {
    const { search, minPrice, maxPrice, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const hasQuery = search || minPrice || maxPrice || sort;

    let allListings;
    let total;

    // CASE 1: SEARCH / SORT / FILTER → ALWAYS DB
    if (hasQuery) {
      let query = {};

      // $text uses the title/location/country index on the model. The previous
      // $regex could not use an index, and passing user input into a regex also
      // let a crafted pattern burn CPU. The trade-off is that $text matches
      // whole words, so "villa" finds "Beach Villa" but "vil" no longer does.
      if (search) {
        query.$text = { $search: search };
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

      // One page at a time. Returning the whole collection was fine at twenty
      // listings and would have meant a several-megabyte response at twenty
      // thousand.
      [allListings, total] = await Promise.all([
        dbQuery.skip(skip).limit(PAGE_SIZE),
        Listing.countDocuments(query),
      ]);
    }

    // CASE 2: SIMPLE LISTING PAGE → TRY REDIS
    else {
      const version = await currentVersion();
      const CACHE_KEY = version === null ? null : pageKey(version, page);

      if (CACHE_KEY) {
        try {
          const cached = await redis.get(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            allListings = parsed.listings;
            total = parsed.total;
          }
        } catch (err) {
          console.log("Redis read failed, using DB");
        }
      }

      if (!allListings) {
        [allListings, total] = await Promise.all([
          Listing.find({}).skip(skip).limit(PAGE_SIZE),
          Listing.estimatedDocumentCount(),
        ]);

        if (CACHE_KEY) {
          try {
            // Jitter on the TTL so that pages cached together do not all expire
            // in the same second and send every reader to the database at once.
            const ttl = 60 + Math.floor(Math.random() * 30);
            await redis.set(CACHE_KEY, JSON.stringify({ listings: allListings, total }), "EX", ttl);
          } catch (err) {
            console.log("Redis write skipped");
          }
        }
      }
    }

    let bookedListings = [];
    if (req.user) {
      bookedListings = await Booking.find({
        user: req.user._id,
        status: { $ne: "cancelled" },
      }).populate("listing");
    }

    const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));

    res.render("listings/index.ejs", {
      allListings,
      bookedListings,
      currentUser: req.user,
      query: search || "",
      minPrice: minPrice || "",
      maxPrice: maxPrice || "",
      sort: sort || "",
      page,
      totalPages,
      total: total || 0
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
      // The helper returns { success, description }, not a string. Assigning
      // the whole object made Mongoose reject the save with a CastError.
      const ai = await generateSmartDescription({
        title: listingData.title,
        location: listingData.location,
        country: listingData.country,
        price: listingData.price,
      });

      if (!ai.success) {
        req.flash("error", "Add a description, or try generating one with AI again.");
        return res.redirect("/listings/new");
      }

      listingData.description = ai.description;
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

    const geometry = await geocodeLocation(listingData.location);

    if (!geometry) {
      req.flash("error", "Invalid location.");
      return res.redirect("/listings/new");
    }

    const newListing = new Listing(listingData);
    newListing.owner = req.user._id;
    newListing.geometry = geometry;

    await newListing.save();

    await bumpVersion();

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

    // Extra content, so a failure here (say the index has not finished
    // building yet) leaves the section empty instead of breaking the page.
    let nearby = [];
    try {
      nearby = await findNearbyListings(listing);
    } catch (err) {
      console.error("Nearby listings query failed:", err.message);
    }

    res.render("listings/show", {
      listing,
      currUser,
      isOwner,
      hasBooked,
      nearby,
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

  // A new location needs new coordinates. Without this the map pin and the
  // "Stays nearby" results kept pointing at the old place after an edit.
  const existing = await Listing.findById(id).select("location");
  if (existing && listingData.location && listingData.location !== existing.location) {
    const geometry = await geocodeLocation(listingData.location);

    if (!geometry) {
      req.flash("error", "Invalid location.");
      return res.redirect(`/listings/${id}/edit`);
    }

    listingData.geometry = geometry;
  }

  await Listing.findByIdAndUpdate(id, listingData);

  // Both cache entries hold a copy of this listing, so both go stale on edit:
  // "listings:all" for the index grid and "listing:<id>" for the detail page.
  // Without this, an edited price kept serving the old value until the 60s TTL
  // expired — long enough for someone to book at a price the host had changed.
  await bumpVersion();
  if (redis) {
    try {
      await redis.del(`listing:${id}`);
    } catch {
      console.log("Redis invalidation skipped after update");
    }
  }

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


/* Render edit form */
// routes/listing.js has always pointed at this name, but it was never written,
// so every "Edit listing" link answered with "fn is not a function" and a 500.
module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "That listing no longer exists.");
    return res.redirect("/listings");
  }

  res.render("listings/edit.ejs", {
    listing,
    // The form shows the current photo as a preview next to the file input.
    originalImageUrl: listing.image && listing.image.url ? listing.image.url : null,
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

  await bumpVersion();
  if (redis) {
    try {
      await redis.del(`listing:${id}`);
    } catch {}
  }

  req.flash("success", "Listing deleted.");
  res.redirect("/listings");
};