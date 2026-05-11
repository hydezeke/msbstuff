const express = require('express');
const db = require('../db/database');
const config = require('../config');
const { validateCsrf } = require('../middleware/csrf');

const router = express.Router();

router.post('/settings/language', validateCsrf, (req, res) => {
  const lang = req.body.lang;
  if (!config.supportedLangs.includes(lang)) {
    return res.redirect('back');
  }

  // Save to cookie (30 days)
  res.cookie('lang', lang, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: false, // readable by JS for progressive enhancement
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Persist to account if logged in
  if (req.session.userId) {
    db.prepare('UPDATE users SET preferred_language = ? WHERE id = ?')
      .run(lang, req.session.userId);
    req.session.preferredLang = lang;
  }

  // Redirect back to where they were
  const returnTo = req.get('Referer') || '/';
  res.redirect(returnTo);
});

module.exports = router;
