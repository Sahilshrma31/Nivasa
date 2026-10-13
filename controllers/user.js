const User = require("../models/user");
const { issueToken, revokeToken } = require("../utils/auth");

// Show the signup form
module.exports.renderSignUp = (req, res) => {
    res.render("users/signup.ejs");
};

// Handle user signup logic
module.exports.signUp = async (req, res) => {
    try {
        let { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        // Signed in straight away: same JWT cookie a normal login gets.
        issueToken(res, registeredUser);
        req.flash("success", "welcome to Nivasa");
        res.redirect("/listings");
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

// Show the login form
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

// Runs after passport has checked the password and set req.user.
module.exports.login = async (req, res) => {
    issueToken(res, req.user);
    req.flash("success", "Welcome back to Nivasa!");
    const redirectUrl = res.locals.redirect || "/listings";
    res.redirect(redirectUrl);
};

// Handle user logout
module.exports.logout = async (req, res) => {
    await revokeToken(req, res);
    req.flash("success", "You are logged out now!");
    res.redirect("/listings");
};
