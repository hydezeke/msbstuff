const db = require('../db/database');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).send('Forbidden');
  }
  next();
}

function loadCurrentUser(req, res, next) {
  if (req.session.userId) {
    const user = db.prepare('SELECT id, username, is_admin, preferred_language FROM users WHERE id = ?').get(req.session.userId);
    if (user) {
      res.locals.currentUser = user;
      // Keep session in sync with account preference
      if (user.preferred_language) req.session.preferredLang = user.preferred_language;
    } else {
      req.session.destroy(() => {});
    }
  } else {
    res.locals.currentUser = null;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, loadCurrentUser };
