module.exports.isLoggedIn=(req,res,next)=>{
    if(!req.isAuthenticated()){
        req.session.redirectUrl=req.originalUrl;
        req.flash("error","you must be logged in to create listing");
        return res.redirect("/login");
    }
    next();
}

module.exports.saveRedirectUrl=(req,res,next)=>{  
    // redirecting users back to the page they were trying to access after they log in. It improves UX by avoiding sending them to a static page like /dashboard every time.
    if(req.session.redirectUrl){
        res.locals.redirect=req.session.redirectUrl;
    }
    next();
}