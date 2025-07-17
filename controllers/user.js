const User = require("../models/user");

module.exports.renderSignUp=(req,res)=>{
    res.render("users/signup.ejs");
};

module.exports.signUp=async(req,res)=>{
    try{
     let {username,email,password}=req.body;
     const newUser=new User({email,username});
     const registeredUser=await User.register(newUser,password);
     console.log(registeredUser);
     req.login(registeredUser,(err)=>{
         if(err){
             return next(err);
         }
         req.flash("success","welcome to Nivasa");
         res.redirect("/listings");
     })
    }catch(e){
     req.flash("error",e.message);
     res.redirect("/signup");
    }
}

module.exports.renderLoginForm=(req,res)=>{
    res.render("users/login.ejs");
}

module.exports.login=async (req, res) => {
    req.flash("success", "Welcome back to Nivasa!");
    const redirectUrl = res.locals.redirect || "/listings";  // fixed here
    res.redirect(redirectUrl);
}

module.exports.logout=(req,res)=>{
    req.logout((err)=>{
        if(err){
          return  next(err);
        }
        req.flash("success","you are logged out now!");
        res.redirect("/listings");
    })
};