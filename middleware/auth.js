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
    const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(req.session.userId);
    if (user) {
      res.locals.currentUser = user;
    } else {
      req.session.destroy(() => {});
    }
  } else {
    res.locals.currentUser = null;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, loadCurrentUser };
