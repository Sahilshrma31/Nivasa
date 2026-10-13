// Flash messages without a session store.
//
// connect-flash keeps messages in req.session, and sessions are gone now that
// login is a JWT. Same idea, kept in a short-lived cookie instead: a message
// set before a redirect is shown on the next page and then cleared. Same API,
// req.flash(type, msg) to set and req.flash(type) to read, so passport's
// failureFlash and every existing call keep working unchanged.

const COOKIE = "flash";
const options = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 1000 };

module.exports = function cookieFlash(req, res, next) {
  let pending = {};
  let cookieSet = Boolean(req.cookies && req.cookies[COOKIE]);
  try {
    pending = JSON.parse((req.cookies && req.cookies[COOKIE]) || "{}");
  } catch {
    pending = {};
  }

  // Rewrite the cookie to match what is still unread or newly added.
  function sync() {
    if (res.headersSent) return;
    if (Object.keys(pending).length) {
      res.cookie(COOKIE, JSON.stringify(pending), options);
      cookieSet = true;
    } else if (cookieSet) {
      res.clearCookie(COOKIE, { path: "/" });
      cookieSet = false;
    }
  }

  req.flash = (type, message) => {
    if (message === undefined) {
      const messages = pending[type] || [];
      delete pending[type];
      sync();
      return messages;
    }

    (pending[type] ||= []).push(String(message));
    sync();
    return pending[type].length;
  };

  next();
};
