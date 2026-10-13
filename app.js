// ---------------------- Environment Config ----------------------
if (process.env.NODE_ENV != "production") { // Interview note: Production mode me .env file ki zarurat nahi, dev mode me load hoti hai
  require("dotenv").config(); // env variables ko process.env me load karna
}

// ---------------------- Required Modules Import ----------------------
const express = require("express"); // Express framework import
const app = express(); // Express application create
const mongoose = require("mongoose"); // MongoDB ke liye mongoose ODM
const Listing = require("./models/listing.js"); // Listing model import (DB schema for listings)
const path = require("path"); // File/folder path handle karne ke liye
const methodOverride = require("method-override"); // PUT/DELETE HTTP methods ko forms me enable karna
const ejsMate = require("ejs-mate"); // EJS layouts & partials support
const wrapAsync = require("./utils/wrapAsync.js"); // Async route error handling wrapper
const reviewRouter = require("./routes/review.js"); // Reviews related routes
const cookieParser = require("cookie-parser"); // Reads cookies (JWT + flash) into req.cookies
const listingRouter = require("./routes/listing.js"); // Listings related routes
const cookieFlash = require("./utils/flash"); // Temporary success/error messages, kept in a cookie
const { authenticate } = require("./utils/auth"); // JWT check on every request -> req.user
const passport = require("passport"); // Authentication library (only checks the password at login)
const LocalStrategy = require("passport-local"); // Username/password based authentication strategy
const User = require("./models/user.js"); // User model import for auth
const userRouter = require("./routes/user.js"); // Authentication routes
const ExpressError = require("./utils/ExpressError"); // Custom error handler class
const { configDotenv } = require("dotenv"); // dotenv config import (optional redundancy)
const paymentRoutes = require("./routes/payment"); // Payment processing routes
const bookingRoutes = require("./routes/booking"); // Booking related routes
const { generateSmartDescription } = require("./utils/aiDescriptionHelper"); // AI generated listing descriptions

// ---------------------- Database Connection ----------------------
// const MONGO_URL = "mongodb://127.0.0.1:27017/Nivasa"; // Local DB URL (commented for production)
const dbUrl = process.env.ATLASDB_URL; // MongoDB Atlas URL from env

main()
  .then(() => { console.log("connected to db"); }) // DB connected successfully
  .catch((err) => { console.log(err); }); // Connection error handling

async function main() { await mongoose.connect(dbUrl); } // Async DB connect function

// ---------------------- View Engine Setup ----------------------
app.set("view engine", "ejs"); // Template engine set
app.set("views", path.join(__dirname, "views")); // Views folder path set
app.use(express.urlencoded({ extended: true })); // Form data parse karega
app.use(methodOverride("_method")); // PUT & DELETE ko enable karega
app.engine("ejs", ejsMate); // EJS layouts engine enable
app.use(express.json()); // JSON request parsing
app.use(express.static(path.join(__dirname, "/public"))); // Public folder serve for static files

// ---------------------- Root Route ----------------------
app.get("/", (req, res) => { res.redirect("/listings"); }); // Root se listings page redirect

// ---------------------- Middleware Setup ----------------------
// No server-side sessions: login state is a JWT in an httpOnly cookie, so the
// app keeps nothing per user in memory or in a session store.
app.use(cookieParser()); // req.cookies
app.use(cookieFlash); // req.flash() backed by a short-lived cookie
app.use(passport.initialize()); // Passport, used only to verify the password at login
app.use(authenticate); // Verify JWT cookie -> req.user (null when logged out)

// ---------------------- Passport Local Auth Strategy ----------------------
passport.use(new LocalStrategy(User.authenticate())); // Username + password check (hash compare)

// ---------------------- Pass User & Flash Messages to Templates ----------------------
app.use((req, res, next) => {
  res.locals.success = req.flash("success"); // Success msg global
  res.locals.error = req.flash("error"); // Error msg global
  res.locals.currUser = req.user; // Current user global
  next();
});

// ---------------------- Demo User Route ----------------------
app.get("/demouser", async (req, res) => { // Dummy account create for testing
  let fakeUser = new User({ email: "student@gmail.com", username: "nerd-student" });
  let registeredUser = await User.register(fakeUser, "helloWorld");
  res.send(registeredUser);
});

app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});

// ---------------------- Routes Setup ----------------------
app.use("/listings", listingRouter); // Listings routes
app.use("/listings/:id/reviews", reviewRouter); // Reviews routes (nested)
app.use("/", userRouter); // Auth routes
app.use("/payments", paymentRoutes); // Payment routes
app.use("/bookings", bookingRoutes); // Booking routes

// ---------------------- Test Listing Route ----------------------
app.get("/testListing", wrapAsync(async (req, res) => { // Test route to create listing
  let sampleListing = new Listing({
    title: "my new villa", description: "by the beach", price: 1200,
    location: "Calangute, Goa", country: "India",
  });
  await sampleListing.save();
  console.log("sample was saved");
  res.send("successfully tested");
}));

// ---------------------- 404 Error Handling ----------------------
app.use((req, res, next) => { next(new ExpressError(404, "Page Not Found")); });

// ---------------------- Global Error Handler ----------------------
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs", { message });
});


// ---------------------- Start Server ----------------------
const PORT = process.env.PORT || 8080; // Interview note: hosting platforms apna port env se dete hain
app.listen(PORT, () => { console.log(`Server is listening on port ${PORT}`); });
