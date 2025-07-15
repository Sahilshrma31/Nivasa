const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const reviews=require("./routes/review.js");
const listings=require("./routes/listing.js")

const MONGO_URL = "mongodb://127.0.0.1:27017/Nivasa";

main()
  .then(() => {
    console.log("connected to db");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}




app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.json());
app.use(express.static(path.join(__dirname, "/public")));

app.use("/listings",listings);
app.use("/listings/:id/reviews",reviews);




// Test route
app.get(
  "/testListing",
  wrapAsync(async (req, res) => {
    let sampleListing = new Listing({
      title: "my new villa",
      description: "by the beach",
      price: 1200,
      location: "Calangute, Goa",
      country: "India",
    });
    await sampleListing.save();
    console.log("sample was saved");
    res.send("successfully tested");
  })
);

// Home route
app.get("/", (req, res) => {
  res.send("welcome to nivasa");
});

// Catch-all route
// app.all("*", (req, res, next) => {
//   next(new ExpressError(404, "Page not found!"));
// });

// 404 handler (no app.all needed)
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found")); // ✅ correct
  });

  
// Error handling middleware
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs",{message});
});


  
app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});
