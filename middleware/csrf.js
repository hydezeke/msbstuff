const crypto = require('crypto');

function injectCsrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function validateCsrf(req, res, next) {
  const token = req.body._csrf;
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).send('Invalid CSRF token.');
  }
  next();
}

module.exports = { injectCsrf, validateCsrf };
