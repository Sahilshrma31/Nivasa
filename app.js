if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const reviewRouter = require("./routes/review.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const listingRouter = require("./routes/listing.js");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const userRouter = require("./routes/user.js");
const ExpressError = require("./utils/ExpressError");
const { configDotenv } = require("dotenv");
const paymentRoutes = require("./routes/payment");
const bookingRoutes = require("./routes/booking");
const {generateSmartDescription}=require("./utils/aiDescriptionHelper");

// MongoDB connection
// const MONGO_URL = "mongodb://127.0.0.1:27017/Nivasa";

const dbUrl=process.env.ATLASDB_URL;

main()
  .then(() => {
    console.log("connected to db");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

const store=MongoStore.create({
  mongoUrl:dbUrl,
  crypto:{
    secret:process.env.SECRET,
  },
  touchAfter:24*3600,
})

store.on("error",()=>{
  console.log("Error in MONGO SESSION STORE",error);
})

// View engine and middlewares
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.json());
app.use(express.static(path.join(__dirname, "/public")));

// Session configuration
const sessionoptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

// Redirect root to listings page
app.get("/", (req, res) => {
  res.redirect("/listings");
});

// Middleware: session, flash, passport initialization
app.use(session(sessionoptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currUser = req.user; // or req.session.user if you store it differently
  next();
});




// Global middleware to expose flash messages and current user in all templates
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Dummy route to create a test user
app.get("/demouser", async (req, res) => {
  let fakeUser = new User({
    email: "student@gmail.com",
    username: "nerd-student",
  });
  let registeredUser = await User.register(fakeUser, "helloWorld");
  res.send(registeredUser);
});

// Routers
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/payments", paymentRoutes);
app.use("/bookings", bookingRoutes);

// Test route for adding a sample listing
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

// Catch-all routes for 404 errors
// app.all("*", (req, res, next) => {
//   next(new ExpressError(404, "Page not found!"));
// });
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

// Error-handling middleware
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

// Start the server
app.listen(8080, () => {
  console.log("Server is listening on port 8080");
});
