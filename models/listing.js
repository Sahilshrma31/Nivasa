const mongoose=require("mongoose");
const Schema=mongoose.Schema;

const listingSchema=new Schema({
    title:{
        type:String,
        required:true,
    },
    description:String,
    image:{
        type:{
            filename:String,
            url: String
        },
        default:"https://unsplash.com/photos/aerial-photography-of-green-mountain-beside-body-of-water-under-white-sky-prSogOoFmkw",//jab dee hi nahi image
        set:(v)=>v==="" ? "https://unsplash.com/photos/aerial-photography-of-green-mountain-beside-body-of-water-under-white-sky-prSogOoFmkw":v,//jab image link empty ho 
        
    },
    price:Number,
    location:String,
    country:String,
});

const Listing=mongoose.model("Listing",listingSchema);
module.exports=Listing;