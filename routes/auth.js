const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { t } = require('../i18n/strings');
const { validateCsrf } = require('../middleware/csrf');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/login', (req, res) => {
  const lang = res.locals.lang;
  const html = layout(t('login.title', lang), `
    <div class="card" style="max-width:420px;margin:2rem auto">
      <h1>${t('login.title', lang)}</h1>
      <form method="POST" action="/login">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="hp-field"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field">
          <label for="username">${t('login.username', lang)}</label>
          <input type="text" id="username" name="username" required autocomplete="username">
        </div>
        <div class="field">
          <label for="password">${t('login.password', lang)}</label>
          <input type="password" id="password" name="password" required autocomplete="current-password">
        </div>
        ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
        <button type="submit" class="btn btn-primary">${t('login.submit', lang)}</button>
      </form>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang });
  res.send(html);
});

router.post('/login', authLimiter, validateCsrf, (req, res) => {
  const { username, password, website } = req.body;
  if (website) return res.redirect('/');

  if (!username || !password) {
    return res.redirect('/login?error=Username+and+password+required');
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.redirect('/login?error=Invalid+username+or+password');
  }

  req.session.regenerate((err) => {
    if (err) return res.redirect('/login?error=Login+failed');
    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin === 1;
    req.session.preferredLang = user.preferred_language || 'en';
    // Sync cookie with account preference
    res.cookie('lang', req.session.preferredLang, {
      maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  });
});

router.post('/logout', validateCsrf, (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
