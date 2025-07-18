const Listing=require("../models/listing");
const mongoose = require('mongoose');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });


module.exports.index=async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
  };

  module.exports.renderNewForm = async (req, res) => {
    res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
      .populate({
        path: "reviews",
        populate: {
          path: "author",
        },
      })
      .populate("owner");
  
    if (!listing) {
      req.flash("error", "Listing you requested for does not exist");
      return res.redirect("/listings");
    }
  
    if (req.user) {
      req.user._id = new mongoose.Types.ObjectId(req.user._id);
    }
  
    res.render("listings/show.ejs", {
      listing,
      currUser: req.user,
      MAP_TOKEN: process.env.MAP_TOKEN, // ✅ Now accessible in EJS
    });
  };
  
  module.exports.createListing = async (req, res) => {

    let response = await geocodingClient.forwardGeocode({
      query: req.body.listing.location,
      limit: 1,
  })
      .send();
    const listingData = req.body.listing; // extract listing data from the form
  
    if (req.file) {
      // only access path and filename if file was uploaded
      listingData.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }
  
    const newListing = new Listing(listingData);
    newListing.owner = req.user._id;
  
    const geoData = response.body.features[0];

if (!geoData) {
  req.flash("error", "Invalid location. Please enter a valid location.");
  return res.redirect("/listings/new");
}

newListing.geometry = geoData.geometry;

    let savedListing = await newListing.save();
    console.log(savedListing);
    req.flash("success", "New listing created successfully.");
    res.redirect(`/listings`);
  };
  

  module.exports.renderEditForm=async (req, res) => {
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

  module.exports.destroyListing=async (req, res) => {
    await Listing.findByIdAndDelete(req.params.id);
  
    req.flash("success", "Listing deleted successfully.");
    res.redirect("/listings");
  };