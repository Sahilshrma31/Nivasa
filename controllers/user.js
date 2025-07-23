const User = require("../models/user");

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
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "welcome to Nivasa");
            res.redirect("/listings");
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

// Show the login form
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

// Handle user login success redirect
module.exports.login = async (req, res) => {
    req.flash("success", "Welcome back to Nivasa!");
    const redirectUrl = res.locals.redirect || "/listings";
    res.redirect(redirectUrl);
};

// Handle user logout
module.exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "You are logged out now!");
        res.redirect("/listings");
    });
};
