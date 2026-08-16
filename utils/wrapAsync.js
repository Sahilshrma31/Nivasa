// Wraps a route handler so rejections reach Express's error handler.
//
// Promise.resolve() matters: a SYNC handler returns undefined, and calling
// .catch() on that throws a TypeError *after* the handler has already called
// res.render(). Express then routes that TypeError to the error handler,
// which renders a second time — two responses for one request, and the
// process dies on ERR_HTTP_HEADERS_SENT. This is what crashed GET
// /listings/new, whose renderNewForm is synchronous.
module.exports = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
