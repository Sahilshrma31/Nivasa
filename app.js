const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const reviewRouter=require("./routes/review.js");
const session=require("express-session");
const listingRouter=require("./routes/listing.js");
const flash=require("connect-flash");
const passport=require("passport");
const LocalStrategy=require("passport-local");
const User=require("./models/user.js");
const userRouter=require("./routes/user.js");
const ExpressError = require("./utils/ExpressError");



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


const sessionoptions={
    secret:"mysupersecretcode",
    resave:false,
    saveUninitialized: true,
      cookie:{
      expires:Date.now()+7*24*60*60*1000,
      maxAge:7*24*60*60*1000,
      httpOnly:true,
    }
};

// Home route
app.get("/", (req, res) => {
  res.send("welcome to nivasa");
});

app.use(session(sessionoptions)); // Session setup karta hai taaki login hone ke baad user remembered rahe (cookie ke through)
app.use(flash()); // Flash messages enable karta hai (jaise error ya success alerts) — ek baar ke liye store hoti hai

app.use(passport.initialize()); // Passport ko initialize karta hai authentication handle karne ke liye
app.use(passport.session()); // Passport ko session ke saath connect karta hai taaki user logged-in state me rahe


passport.use(new LocalStrategy(User.authenticate())); // Passport ko bolta hai local strategy use kare (username/password) — User model se authenticate method deta hai

passport.serializeUser(User.serializeUser()); // Decide karta hai ki session me user ka kya store hoga (usually user.id)
passport.deserializeUser(User.deserializeUser()); // Jab request aaye tab session se user.id se pura user object wapas laata hai


app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");  
  res.locals.currUser=req.user;  
//   Why res.locals.curruser = req.user?
// res.locals ek aisi object hoti hai jo har EJS template me accessible hoti hai automatically.
  next();
});

app.get("/demouser", async (req, res) => {
  // Ek naya fake user banaya with email and username (password abhi nahi diya)
  let fakeUser = new User({
    email: "student@gmail.com",
    username: "nerd-student"
  });
  // User ko register kiya with password "helloWorld"
  // register() method password ko hash karta hai + user ko save karta hai
  let registeredUser = await User.register(fakeUser, "helloWorld");
  res.send(registeredUser);
});


app.use("/listings",listingRouter);
app.use("/listings/:id/reviews",reviewRouter);
app.use("/",userRouter);

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
