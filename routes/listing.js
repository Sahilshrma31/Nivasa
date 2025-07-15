const express=require("express");
const router=express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const {listingSchema,reviewSchema}=require("../schema.js");
const ExpressError = require("../utils/ExpressError");
const Listing = require("../models/listing.js");
const multer = require("multer");
const upload = multer({ dest: "uploads/" }); // Stores uploaded files temporarily in /uploads




const validateListing=(req,res,next)=>{
    let {error}=listingSchema.validate(req.body);
    if(error){
        let errMsg=error.details.map((el)=>el.message).join(",");
        throw new ExpressError(400,error);
    }else{
        next();
        }
}

// Index route
// Index
router.get("/", wrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
  }));
  
  // New form
  router.get("/new", wrapAsync(async (req, res) => {
    res.render("listings/new.ejs");
  }));
  
  // Show
  router.get("/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("reviews");
    res.render("listings/show.ejs", { listing });
  }));
  
  // Create a new listing
router.post(
    "/",
    upload.single("listing[image]"), // Middleware to handle file upload from form
    validateListing, // Middleware to validate form data using Joi
    wrapAsync(async (req, res) => {
      const listingData = req.body.listing; // Extract listing details from form
  
      if (req.file) {
        // If image was uploaded, attach image data to listing
        listingData.image = {
          url: req.file.path, // Local file path (e.g., uploads/xyz123)
          filename: req.file.filename, // Generated filename
        };
      }
  
      const newListing = new Listing(listingData); // Create new Listing model
      await newListing.save(); // Save to MongoDB
      res.redirect(`/listings/${newListing._id}`); // Redirect to the newly created listing
    })
  );
  
  
  // Edit
  router.get("/:id/edit", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/edit.ejs", { listing });
  }));
  
  // Update
  router.put(
    "/:id",
    upload.single("listing[image]"), // 🌟 MUST come first to parse the form-data!
    validateListing,
    wrapAsync(async (req, res) => {
      const { id } = req.params;
  
      await Listing.findByIdAndUpdate(id, { ...req.body.listing });
      res.redirect(`/listings/${id}`);
    })
  );
  
  // Delete
  router.delete("/:id", wrapAsync(async (req, res) => {
    await Listing.findByIdAndDelete(req.params.id);
    res.redirect("/listings");
  }));

  module.exports=router;
  