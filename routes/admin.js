const express = require('express');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { requireAdmin } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { postLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── Admin dashboard ──────────────────────────────────────

router.get('/admin', requireAdmin, (req, res) => {
  const flagged = db.prepare(`
    SELECT l.*, u.username,
      (SELECT COUNT(*) FROM flags f WHERE f.listing_id = l.id) as flag_count
    FROM listings l
    JOIN users u ON l.user_id = u.id
    WHERE l.is_deleted = 0 AND l.flag_count > 0
    ORDER BY l.flag_count DESC, l.created_at DESC
  `).all();

  const allListings = db.prepare(`
    SELECT l.*, u.username FROM listings l
    JOIN users u ON l.user_id = u.id
    WHERE l.is_deleted = 0
    ORDER BY l.created_at DESC
    LIMIT 50
  `).all();

  const users = db.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC').all();
  const flash = req.session.flash ? consumeFlash(req) : null;

  const flaggedRows = flagged.length === 0
    ? '<p class="empty-state">No flagged listings.</p>'
    : flagged.map(l => `
        <tr>
          <td><a href="/listings/${l.id}">${esc(l.title)}</a></td>
          <td>${esc(l.username)}</td>
          <td style="color:#c0392b;font-weight:600">${l.flag_count}</td>
          <td>
            <form method="POST" action="/admin/listings/${l.id}/delete" style="display:inline">
              <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
              <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Delete listing?')">Delete</button>
            </form>
            <form method="POST" action="/admin/listings/${l.id}/unflag" style="display:inline;margin-left:0.5rem">
              <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
              <button type="submit" class="btn btn-secondary btn-sm">Clear flags</button>
            </form>
          </td>
        </tr>
      `).join('');

  const listingRows = allListings.map(l => `
    <tr>
      <td><a href="/listings/${l.id}">${esc(l.title)}</a></td>
      <td>${esc(l.username)}</td>
      <td>
        <form method="POST" action="/admin/listings/${l.id}/delete" style="display:inline">
          <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
          <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Delete listing?')">Delete</button>
        </form>
      </td>
    </tr>
  `).join('');

  const userRows = users.map(u => `
    <tr>
      <td>${esc(u.username)}</td>
      <td>${u.is_admin ? '<strong>Admin</strong>' : 'Neighbor'}</td>
      <td style="font-size:0.85rem;color:var(--text-muted)">${new Date(u.created_at * 1000).toLocaleDateString()}</td>
    </tr>
  `).join('');

  const html = layout('Admin Dashboard', `
    <div class="page-header">
      <h1>Admin Dashboard</h1>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <a href="/admin/tags" class="btn btn-secondary btn-sm">Manage Tags</a>
        <a href="/admin/invite" class="btn btn-primary btn-sm">Invite Links</a>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.25rem">
      <h2 style="margin-bottom:0.75rem">Flagged Listings</h2>
      ${flagged.length > 0 ? `
        <table>
          <thead><tr><th>Title</th><th>Posted by</th><th>Flags</th><th>Actions</th></tr></thead>
          <tbody>${flaggedRows}</tbody>
        </table>
      ` : flaggedRows}
    </div>

    <div class="card" style="margin-bottom:1.25rem">
      <h2 style="margin-bottom:0.75rem">All Listings (last 50)</h2>
      ${allListings.length > 0 ? `
        <table>
          <thead><tr><th>Title</th><th>Posted by</th><th>Actions</th></tr></thead>
          <tbody>${listingRows}</tbody>
        </table>
      ` : '<p class="empty-state">No listings yet.</p>'}
    </div>

    <div class="card">
      <h2 style="margin-bottom:0.75rem">Neighbors</h2>
      <table>
        <thead><tr><th>Username</th><th>Role</th><th>Joined</th></tr></thead>
        <tbody>${userRows}</tbody>
      </table>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, flash });
  res.send(html);
});

router.post('/admin/listings/:id/delete', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  db.prepare('UPDATE listings SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  req.session.flash = { type: 'success', message: 'Listing deleted.' };
  res.redirect('/admin');
});

router.post('/admin/listings/:id/unflag', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  db.prepare('UPDATE listings SET flag_count = 0 WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM flags WHERE listing_id = ?').run(req.params.id);
  req.session.flash = { type: 'success', message: 'Flags cleared.' };
  res.redirect('/admin');
});

// ── Tag management ───────────────────────────────────────

router.get('/admin/tags', requireAdmin, (req, res) => {
  const tags = db.prepare(`
    SELECT t.*, u.username as creator,
      (SELECT COUNT(*) FROM listing_tags lt WHERE lt.tag_id = t.id) as usage_count
    FROM tags t
    JOIN users u ON t.created_by = u.id
    ORDER BY t.name
  `).all();

  const flash = req.session.flash ? consumeFlash(req) : null;

  const rows = tags.map(t => `
    <tr>
      <td>
        <span class="tag" style="background:${esc(t.color)}">${esc(t.name)}</span>
      </td>
      <td><code>${esc(t.color)}</code></td>
      <td>${t.usage_count}</td>
      <td>${esc(t.creator)}</td>
      <td>
        <form method="POST" action="/admin/tags/${t.id}/delete" style="display:inline"
              onsubmit="return confirm('Delete tag \'${esc(t.name)}\'? It will be removed from all listings.')">
          <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
          <button type="submit" class="btn btn-danger btn-sm">Delete</button>
        </form>
      </td>
    </tr>
  `).join('');

  const html = layout('Manage Tags', `
    <div class="page-header">
      <h1>Manage Tags</h1>
      <a href="/admin" class="btn btn-secondary btn-sm">← Admin</a>
    </div>

    <div class="card" style="max-width:480px;margin-bottom:1.5rem">
      <h2>Create New Tag</h2>
      <form method="POST" action="/admin/tags">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="field">
          <label for="tag-name">Tag Name</label>
          <input type="text" id="tag-name" name="name" required maxlength="40"
                 placeholder="e.g. Free Stuff, Power Tools, Plants…">
        </div>
        <div class="field">
          <label for="tag-color">Color</label>
          <div style="display:flex;gap:0.75rem;align-items:center">
            <input type="color" id="tag-color" name="color" value="#4A8469" style="width:4rem">
            <span style="font-size:0.875rem;color:var(--text-muted)">Pick a color for the tag pill</span>
          </div>
        </div>
        ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
        <button type="submit" class="btn btn-primary">Create Tag</button>
      </form>
    </div>

    <div class="card">
      <h2 style="margin-bottom:0.75rem">All Tags</h2>
      ${tags.length === 0
        ? '<p class="empty-state">No tags yet.</p>'
        : `<table>
            <thead><tr><th>Tag</th><th>Color</th><th>Used on</th><th>Created by</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`}
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, flash });
  res.send(html);
});

router.post('/admin/tags', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) {
    return res.redirect('/admin/tags?error=Tag+name+is+required');
  }
  const sanitizedColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#888888';

  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name.trim());
  if (existing) {
    return res.redirect('/admin/tags?error=A+tag+with+that+name+already+exists');
  }

  db.prepare('INSERT INTO tags (name, color, created_by, created_at) VALUES (?, ?, ?, ?)')
    .run(name.trim(), sanitizedColor, req.session.userId, Math.floor(Date.now() / 1000));

  req.session.flash = { type: 'success', message: `Tag "${name.trim()}" created.` };
  res.redirect('/admin/tags');
});

router.post('/admin/tags/:id/delete', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.redirect('/admin/tags');

  db.prepare('DELETE FROM listing_tags WHERE tag_id = ?').run(tag.id);
  db.prepare('DELETE FROM tags WHERE id = ?').run(tag.id);

  req.session.flash = { type: 'success', message: `Tag "${tag.name}" deleted.` };
  res.redirect('/admin/tags');
});

// ── Invite tokens ────────────────────────────────────────
// (kept here for co-location; invite generation logic is in routes/invite.js)

function consumeFlash(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f;
}

module.exports = router;
