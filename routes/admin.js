const express = require('express');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { requireAdmin } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { postLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

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
          <td style="color:#dc2626;font-weight:600">${l.flag_count}</td>
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
      <td><span class="badge badge-${esc(l.category)}">${l.category === 'give' ? 'Free' : 'Borrow'}</span></td>
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
      <td style="font-size:0.85rem;color:#888">${new Date(u.created_at * 1000).toLocaleDateString()}</td>
    </tr>
  `).join('');

  const html = layout('Admin Dashboard', `
    <div class="page-header">
      <h1>Admin Dashboard</h1>
      <a href="/admin/invite" class="btn btn-primary btn-sm">Manage Invite Links</a>
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
      <table>
        <thead><tr><th>Title</th><th>Posted by</th><th>Type</th><th>Actions</th></tr></thead>
        <tbody>${listingRows}</tbody>
      </table>
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

function consumeFlash(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f;
}

module.exports = router;
