const mongoose=require("mongoose");
const Schema=mongoose.Schema;
const Review=require("./review.js");
const Booking=require("./booking.js");


const listingSchema=new Schema({
    title:{
        type:String,
        required:true,
    },
    description:String,
    image: {
      url: String,
      filename: String,
  },
      
  price: {
    type: Number,
    required: true, // <--- ADD THIS
    min: 0          // <--- Good practice: Price cannot be negative
},
    location:String,
    country:String,
    reviews:[{
        type:Schema.Types.ObjectId,
        ref:"Review"
    }
    ],
    owner:{
      type:Schema.Types.ObjectId,
      ref:"User",
    },
    geometry: {
      type: {
          type: String, // Don't do `{ location: { type: String } }`
          enum: ['Point'], // 'location.type' must be 'Point'
          required: true,
      },
      coordinates: {
          type: [Number],
          required: true,
      },
  },
});


listingSchema.post("findOneAndDelete", async (listing) => { // Post middleware after a listing is deleted
    if (listing) { // Only run if a listing was actually found and deleted
      await Review.deleteMany({ _id: { $in: listing.reviews } }); // Delete all reviews whose _id is in the deleted listing's reviews array
      // Bookings point at this listing too. Without this, populate() returns
      // null for them and /bookings/mine throws on booking.listing._id.
      await Booking.deleteMany({ listing: listing._id });
    }
  });
  


const Listing=mongoose.model("Listing",listingSchema);
module.exports=Listing;