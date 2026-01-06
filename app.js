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
const session = require("express-session"); // Session middleware for user login persistence
const MongoStore = require('connect-mongo'); // Session store in MongoDB
const listingRouter = require("./routes/listing.js"); // Listings related routes
const flash = require("connect-flash"); // Temporary success/error messages
const passport = require("passport"); // Authentication library
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

// ---------------------- Session Store in MongoDB ----------------------
const store = MongoStore.create({ // Session store create
  mongoUrl: dbUrl, // Database URL
  crypto: { secret: process.env.SECRET }, // Encrypt session data
  touchAfter: 24 * 3600, // Session ko sirf 24 hours baad update kare
});
store.on("error", () => { console.log("Error in MONGO SESSION STORE", error); }); // Store error handling

// ---------------------- View Engine Setup ----------------------
app.set("view engine", "ejs"); // Template engine set
app.set("views", path.join(__dirname, "views")); // Views folder path set
app.use(express.urlencoded({ extended: true })); // Form data parse karega
app.use(methodOverride("_method")); // PUT & DELETE ko enable karega
app.engine("ejs", ejsMate); // EJS layouts engine enable
app.use(express.json()); // JSON request parsing
app.use(express.static(path.join(__dirname, "/public"))); // Public folder serve for static files

// ---------------------- Session Configuration ----------------------
const sessionoptions = {
  store, // MongoDB session store
  secret: process.env.SECRET, // Session secret from env
  resave: false, // Har request pe session save mat karo
  saveUninitialized: true, // Blank sessions bhi save ho
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // Expire in 7 days
    maxAge: 7 * 24 * 60 * 60 * 1000, // Max age 7 days
    httpOnly: true, // JS se cookie access na ho (security)
  },
};

// ---------------------- Root Route ----------------------
app.get("/", (req, res) => { res.redirect("/listings"); }); // Root se listings page redirect

// ---------------------- Middleware Setup ----------------------
app.use(session(sessionoptions)); // Session enable
app.use(flash()); // Flash messages enable
app.use(passport.initialize()); // Passport auth initialize
app.use(passport.session()); // Persistent login enable

// ---------------------- Passport Local Auth Strategy ----------------------
passport.use(new LocalStrategy(User.authenticate())); // LocalStrategy with User model
passport.serializeUser(User.serializeUser()); // User ko session me store kare
passport.deserializeUser(User.deserializeUser()); // Session se user retrieve kare

// ---------------------- Pass User & Flash Messages to Templates ----------------------
app.use((req, res, next) => { res.locals.currUser = req.user; next(); }); // Current user har template me available
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
app.listen(8080, () => { console.log("Server is listening on port 8080"); });
