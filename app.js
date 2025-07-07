const express=require("express");
const app=express();
const mongoose=require("mongoose");
const Listing=require("./models/listing.js");
const path=require("path");

const MONGO_URL="mongodb://127.0.0.1:27017/Nivasa"

main()
    .then(()=>{
        console.log("connected to db");
    })
    .catch((err)=>{
        console.log(err);
    });

async function main() {
    await mongoose.connect(MONGO_URL);
    
}

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));//sara data request ke andr parse ho paye

//index route
app.get("/listings",async(req,res)=>{
    const allListings=await Listing.find({});
    res.render("listings/index.ejs",{allListings});
});

//show route
app.get("/listings/:id",async(req,res)=>{
   let {id}=req.params;
   const listing=await Listing.findById(id);
   res.render("listings/show.ejs",{listing});
})

app.get("/testListing",async(req,res)=>{
    let sampleListing=new Listing({
        title:"my new villa",
        description:"by the beach",
        price:1200,
        location:"Calangute,goa",
        country:"India",
    });
    await sampleListing.save();
    console.log("sample was saved");
    res.send("successfull testing");
});


app.get("/",(req,res)=>{
    res.send("hi am root")
})

app.listen(8080,()=>{
    console.log("server is listening to port 8080");
})