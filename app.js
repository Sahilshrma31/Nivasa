const express=require("express");
const app=express();
const mongoose=require("mongoose");
const Listing=require("./models/listing.js");
const path=require("path");
const methodOverride = require('method-override');
const ejsMate=require("ejs-mate"); //for using repetitive layouts
const multer = require("multer");
const upload = multer({ dest: 'uploads/' }); // stores files in uploads/ folder



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
app.use(methodOverride("_method"));
app.engine("ejs",ejsMate);
app.use(express.json());
app.use(express.static(path.join(__dirname,"/public")));

//index route
app.get("/listings",async(req,res)=>{
    const allListings=await Listing.find({});
    res.render("listings/index.ejs",{allListings});
   

});

//new route
app.get("/listings/new",async(req,res)=>{
    res.render("listings/new.ejs")
})

//show route
app.get("/listings/:id",async(req,res)=>{
   let {id}=req.params;
   const listing=await Listing.findById(id);
   res.render("listings/show.ejs",{listing});
})

//create route

// Handles POST request to /listings (form submission route)
app.post("/listings", upload.single('listing[image]'), async (req, res) => {    // Handle POST request to create new listing
    const newListing = new Listing(req.body.listing);           // Create a new listing from form data
    await newListing.save();                                    // Save the new listing to the database
    res.redirect("/listings");                                  // Redirect to the listings page after saving
});


//edit route
app.get("/listings/:id/edit",async (req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id);
    res.render("listings/edit.ejs",{listing});
})

//update route
app.put("/listings/:id", upload.single('listing[image]'), async (req, res) => {
    let { id } = req.params;

    // image ka handling (optional): agar user new image upload kare
    if (req.file) {
        req.body.listing.image = {
            url: `/uploads/${req.file.filename}`,
        };
    }

    await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    res.redirect(`/listings/${id}`);
});


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

//delete route
app.delete("/listings/:id", async (req, res) => {
    await Listing.findByIdAndDelete(req.params.id);
    res.redirect("/listings");
  });
  


app.get("/",(req,res)=>{
    res.send("welcome to nivasa");
})

app.listen(8080,()=>{
    console.log("server is listening to port 8080");
})