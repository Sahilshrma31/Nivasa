const express = require("express");
const router = express.Router(); 
const User = require("../models/user");
const ExpressError = require("../utils/ExpressError");
const wrapAsync = require("../utils/wrapAsync.js");
const passport=require("passport");
const { saveRedirectUrl } = require("../middleware.js");
const userController=require("../controllers/user");


router.get("/signup",userController.renderSignUp);

router.post("/signup",wrapAsync(userController.signUp));

router.get("/login",userController.renderLoginForm);

router.post("/login",
    saveRedirectUrl,
    passport.authenticate("local", {
        failureRedirect: '/login',
        failureFlash: true
    }),
   userController.login
);



router.get("/logout",userController.logout);

module.exports=router;