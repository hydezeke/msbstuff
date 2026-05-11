const config = require('../config');

function langMiddleware(req, res, next) {
  // Priority: account preference > cookie > default
  let lang = null;

  if (req.session.userId && req.session.preferredLang) {
    lang = req.session.preferredLang;
  } else {
    lang = req.cookies && req.cookies.lang;
  }

  if (!lang || !config.supportedLangs.includes(lang)) {
    lang = config.defaultLang;
  }

  res.locals.lang = lang;
  next();
}

module.exports = { langMiddleware };
