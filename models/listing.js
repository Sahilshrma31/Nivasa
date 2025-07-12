const mongoose=require("mongoose");
const Schema=mongoose.Schema;

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
});

const Listing=mongoose.model("Listing",listingSchema);
module.exports=Listing;