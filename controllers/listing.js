const Listing=require("../models/listing");
const mongoose = require('mongoose');


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
        path:"reviews",
        populate:{
          path:"author",
        },
      })
      .populate("owner");
  
    if (!listing) {
      req.flash("error", "Listing you requested for does not exist");
      return res.redirect("/listings");
    }
    // This makes sure .equals() won't throw an error in EJS
    if (req.user) {
      req.user._id = new mongoose.Types.ObjectId(req.user._id);
    }
    //  Pass currUser to EJS
    res.render("listings/show.ejs", { listing, currUser: req.user });
  };

  module.exports.createListing=async (req, res) => { //error handle karne ke liye async function wrapAsync se wrapped hai
    const listingData = req.body.listing; //form se aaya hua listing data extract kar rahe hain

    if (req.file) { //agar koi file upload hui hai
      listingData.image = {
        url: req.file.path, //image ka path save kar rahe hain
        filename: req.file.filename, //image ka filename save kar rahe hain
      };
    }

    const newListing = new Listing(listingData); //listingData ke basis pe naya Listing object banaya
    newListing.owner=req.user._id; //current logged in user ko as owner assign kiya
    await newListing.save(); //listing ko database me save kiya

    req.flash("success", "New listing created successfully."); //success message flash kiya
    res.redirect(`/listings`); //user ko listings page pe redirect kiya
  };

  module.exports.renderEditForm=async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
      req.flash("error", "Listing you requested for does not exist");
      return res.redirect("/listings");
    }
  
    res.render("listings/edit.ejs", { listing });
  };

  module.exports.updateListing=async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    req.flash("success", "Listing updated successfully.");
    res.redirect(`/listings/${id}`);
  };

  module.exports.destroyListing=async (req, res) => {
    await Listing.findByIdAndDelete(req.params.id);
  
    req.flash("success", "Listing deleted successfully.");
    res.redirect("/listings");
  };