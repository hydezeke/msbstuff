const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { requireAdmin } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { authLimiter, postLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Registration via invite token
router.get('/join/:token', (req, res) => {
  const token = db.prepare(
    'SELECT * FROM invite_tokens WHERE token = ? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > ?)'
  ).get(req.params.token, Math.floor(Date.now() / 1000));

  if (!token) {
    return res.status(400).send(layout('Invalid Invite', `
      <div class="card" style="max-width:420px;margin:2rem auto">
        <h1>Invalid or Expired Invite</h1>
        <p>This invite link is invalid, has already been used, or has expired.</p>
        <p><a href="/">Browse listings</a></p>
      </div>
    `, { currentUser: res.locals.currentUser }));
  }

  const html = layout('Create Account', `
    <div class="card" style="max-width:420px;margin:2rem auto">
      <h1>Join the Neighborhood</h1>
      <p style="margin-bottom:1rem;color:#555">Choose a username (no real name needed).</p>
      <form method="POST" action="/join/${esc(req.params.token)}">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="hp-field"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field">
          <label for="username">Username / Handle</label>
          <input type="text" id="username" name="username" required autocomplete="username"
            pattern="[a-zA-Z0-9_-]{2,30}" title="2–30 characters: letters, numbers, _ or -">
          <p class="hint">2–30 characters. No real name required.</p>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autocomplete="new-password" minlength="8">
          <p class="hint">At least 8 characters.</p>
        </div>
        ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
        <button type="submit" class="btn btn-primary">Create Account</button>
      </form>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken });
  res.send(html);
});

router.post('/join/:token', authLimiter, validateCsrf, (req, res) => {
  const { username, password, website } = req.body;
  if (website) return res.redirect('/');

  const token = db.prepare(
    'SELECT * FROM invite_tokens WHERE token = ? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > ?)'
  ).get(req.params.token, Math.floor(Date.now() / 1000));

  if (!token) {
    return res.status(400).redirect(`/join/${req.params.token}?error=This+invite+is+no+longer+valid`);
  }

  if (!username || !password) {
    return res.redirect(`/join/${req.params.token}?error=All+fields+required`);
  }
  if (!/^[a-zA-Z0-9_-]{2,30}$/.test(username)) {
    return res.redirect(`/join/${req.params.token}?error=Username+must+be+2-30+characters+(letters,+numbers,+_+-+only)`);
  }
  if (password.length < 8) {
    return res.redirect(`/join/${req.params.token}?error=Password+must+be+at+least+8+characters`);
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    return res.redirect(`/join/${req.params.token}?error=That+username+is+taken`);
  }

  const hash = bcrypt.hashSync(password, 12);
  const now = Math.floor(Date.now() / 1000);

  const result = db.prepare(
    'INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, 0, ?)'
  ).run(username.trim(), hash, now);

  db.prepare('UPDATE invite_tokens SET used_by = ?, used_at = ? WHERE id = ?')
    .run(result.lastInsertRowid, now, token.id);

  req.session.regenerate((err) => {
    if (err) return res.redirect('/login');
    req.session.userId = result.lastInsertRowid;
    req.session.isAdmin = false;
    res.redirect('/');
  });
});

// Admin: generate invite tokens
router.get('/admin/invite', requireAdmin, (req, res) => {
  const tokens = db.prepare(`
    SELECT t.*, u.username as creator, u2.username as redeemed_by
    FROM invite_tokens t
    JOIN users u ON t.created_by = u.id
    LEFT JOIN users u2 ON t.used_by = u2.id
    ORDER BY t.id DESC
  `).all();

  const rows = tokens.map(t => `
    <tr>
      <td><code>${esc(t.token)}</code></td>
      <td>${esc(t.creator)}</td>
      <td>${t.redeemed_by ? esc(t.redeemed_by) : '<em>unused</em>'}</td>
      <td>${t.expires_at ? new Date(t.expires_at * 1000).toLocaleDateString() : 'never'}</td>
    </tr>
  `).join('');

  const html = layout('Invite Tokens', `
    <div class="page-header">
      <h1>Invite Tokens</h1>
      <a href="/admin" class="btn btn-secondary btn-sm">← Admin</a>
    </div>
    <div class="card" style="max-width:500px;margin-bottom:1.5rem">
      <h2>Generate New Invite</h2>
      <form method="POST" action="/admin/invite">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="field">
          <label for="expires_days">Expires in (days, leave blank for no expiry)</label>
          <input type="number" id="expires_days" name="expires_days" min="1" max="365" placeholder="e.g. 7">
        </div>
        <button type="submit" class="btn btn-primary">Generate Link</button>
      </form>
      ${req.query.new_token ? `
        <div style="margin-top:1rem;padding:0.75rem;background:#d8f3dc;border-radius:5px">
          <strong>Share this link:</strong><br>
          <code id="new-link">${esc(req.query.base_url)}/join/${esc(req.query.new_token)}</code>
        </div>
      ` : ''}
    </div>
    <div class="card">
      <h2>All Tokens</h2>
      ${tokens.length === 0 ? '<p class="empty-state">No tokens yet.</p>' : `
        <table>
          <thead><tr><th>Token</th><th>Created by</th><th>Used by</th><th>Expires</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `}
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken });
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
