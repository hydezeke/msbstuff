const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { t } = require('../i18n/strings');
const { requireAdmin } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { authLimiter, postLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/join/:token', (req, res) => {
  const lang = res.locals.lang;
  const token = db.prepare(
    'SELECT * FROM invite_tokens WHERE token = ? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > ?)'
  ).get(req.params.token, Math.floor(Date.now() / 1000));

  if (!token) {
    return res.status(400).send(layout(t('register.invalid', lang), `
      <div class="card" style="max-width:420px;margin:2rem auto">
        <h1>${t('register.invalid', lang)}</h1>
        <p>${t('register.invalid_body', lang)}</p>
        <p><a href="/">${t('register.browse', lang)}</a></p>
      </div>
    `, { currentUser: res.locals.currentUser, lang }));
  }

  const html = layout(t('register.title', lang), `
    <div class="card" style="max-width:420px;margin:2rem auto">
      <h1>${t('register.title', lang)}</h1>
      <p style="margin-bottom:1rem;color:var(--text-muted)">${t('register.intro', lang)}</p>
      <form method="POST" action="/join/${esc(req.params.token)}">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="hp-field"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field">
          <label for="username">${t('register.label_user', lang)}</label>
          <input type="text" id="username" name="username" required autocomplete="username"
            pattern="[a-zA-Z0-9_-]{2,30}" title="2–30 characters: letters, numbers, _ or -">
          <p class="hint">${t('register.hint_user', lang)}</p>
        </div>
        <div class="field">
          <label for="password">${t('register.label_pass', lang)}</label>
          <input type="password" id="password" name="password" required autocomplete="new-password" minlength="8">
          <p class="hint">${t('register.hint_pass', lang)}</p>
        </div>
        ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
        <button type="submit" class="btn btn-primary">${t('register.submit', lang)}</button>
      </form>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang });
  res.send(html);
});

router.post('/join/:token', authLimiter, validateCsrf, (req, res) => {
  const { username, password, website } = req.body;
  if (website) return res.redirect('/');

  const token = db.prepare(
    'SELECT * FROM invite_tokens WHERE token = ? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > ?)'
  ).get(req.params.token, Math.floor(Date.now() / 1000));

  if (!token) return res.redirect(`/join/${req.params.token}?error=This+invite+is+no+longer+valid`);
  if (!username || !password) return res.redirect(`/join/${req.params.token}?error=All+fields+required`);
  if (!/^[a-zA-Z0-9_-]{2,30}$/.test(username)) return res.redirect(`/join/${req.params.token}?error=Invalid+username`);
  if (password.length < 8) return res.redirect(`/join/${req.params.token}?error=Password+too+short`);

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.redirect(`/join/${req.params.token}?error=Username+taken`);

  const hash = bcrypt.hashSync(password, 12);
  const now = Math.floor(Date.now() / 1000);
  // New users get the language they registered with as their default
  const langPref = res.locals.lang || 'en';

  const result = db.prepare(
    'INSERT INTO users (username, password_hash, is_admin, preferred_language, created_at) VALUES (?, ?, 0, ?, ?)'
  ).run(username.trim(), hash, langPref, now);

  db.prepare('UPDATE invite_tokens SET used_by = ?, used_at = ? WHERE id = ?')
    .run(result.lastInsertRowid, now, token.id);

  req.session.regenerate((err) => {
    if (err) return res.redirect('/login');
    req.session.userId = result.lastInsertRowid;
    req.session.isAdmin = false;
    req.session.preferredLang = langPref;
    res.redirect('/');
  });
});

// Admin: generate invite tokens
router.get('/admin/invite', requireAdmin, (req, res) => {
  const lang = res.locals.lang;
  const tokens = db.prepare(`
    SELECT t.*, u.username as creator, u2.username as redeemed_by
    FROM invite_tokens t
    JOIN users u ON t.created_by = u.id
    LEFT JOIN users u2 ON t.used_by = u2.id
    ORDER BY t.id DESC
  `).all();

  const rows = tokens.map(tok => `
    <tr>
      <td><code>${esc(tok.token)}</code></td>
      <td>${esc(tok.creator)}</td>
      <td>${tok.redeemed_by ? esc(tok.redeemed_by) : `<em>${t('invite.unused', lang)}</em>`}</td>
      <td>${tok.expires_at ? new Date(tok.expires_at * 1000).toLocaleDateString() : t('invite.never', lang)}</td>
    </tr>
  `).join('');

  const html = layout(t('invite.title', lang), `
    <div class="page-header">
      <h1>${t('invite.title', lang)}</h1>
      <a href="/admin" class="btn btn-secondary btn-sm">${t('invite.back', lang)}</a>
    </div>
    <div class="card" style="max-width:500px;margin-bottom:1.5rem">
      <h2>${t('invite.generate', lang)}</h2>
      <form method="POST" action="/admin/invite">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="field">
          <label for="expires_days">${t('invite.label_expires', lang)}</label>
          <input type="number" id="expires_days" name="expires_days" min="1" max="365" placeholder="7">
        </div>
        <button type="submit" class="btn btn-primary">${t('invite.submit', lang)}</button>
      </form>
      ${req.query.new_token ? `
        <div style="margin-top:1rem;padding:0.75rem;background:#ddf0e8;border-radius:5px">
          <strong>${t('invite.share', lang)}</strong><br>
          <code>${esc(req.query.base_url)}/join/${esc(req.query.new_token)}</code>
        </div>
      ` : ''}
    </div>
    <div class="card">
      <h2>${t('invite.all', lang)}</h2>
      ${tokens.length === 0 ? `<p class="empty-state">${t('invite.none', lang)}</p>` : `
        <table>
          <thead><tr>
            <th>${t('invite.col_token', lang)}</th>
            <th>${t('invite.col_created', lang)}</th>
            <th>${t('invite.col_used', lang)}</th>
            <th>${t('invite.col_expires', lang)}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang });
  res.send(html);
});

router.post('/admin/invite', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const expiresDays = parseInt(req.body.expires_days, 10);
  const expiresAt = expiresDays > 0 ? now + expiresDays * 86400 : null;

  db.prepare('INSERT INTO invite_tokens (token, created_by, expires_at) VALUES (?, ?, ?)')
    .run(token, req.session.userId, expiresAt);

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.redirect(`/admin/invite?new_token=${token}&base_url=${encodeURIComponent(baseUrl)}`);
});

module.exports = router;
