function checkHoneypot(req, res, next) {
  if (req.body && req.body.website) {
    // Silently accept but do nothing — bot filled the hidden field
    return res.redirect('/');
  }
  next();
}

module.exports = { checkHoneypot };
