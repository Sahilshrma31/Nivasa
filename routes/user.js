const express = require("express");
const router = express.Router(); 
const User = require("../models/user");
const ExpressError = require("../utils/ExpressError");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware.js");
const userController = require("../controllers/user");

// signup routes
router.route("/signup")
  .get(userController.renderSignUp) // show signup form
  .post(wrapAsync(userController.signUp)); // handle signup

// login routes
router.route("/login")
  .get(userController.renderLoginForm) // show login form
  .post(
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true
    }),
    userController.login // handle login
  );

// logout route
router.get("/logout", userController.logout); // handle logout

module.exports = router;
