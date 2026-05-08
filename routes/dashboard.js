const express = require('express');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { requireAuth } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { postLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/dashboard', requireAuth, (req, res) => {
  const listings = db.prepare(`
    SELECT * FROM listings WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC
  `).all(req.session.userId);

  const contacts = db.prepare(`
    SELECT cr.*, l.title as listing_title, l.id as listing_id
    FROM contact_requests cr
    JOIN listings l ON cr.listing_id = l.id
    WHERE l.user_id = ? AND l.is_deleted = 0
    ORDER BY cr.created_at DESC
  `).all(req.session.userId);

  const listingRows = listings.length === 0
    ? '<p class="empty-state">You haven\'t posted anything yet. <a href="/listings/new">Post an item!</a></p>'
    : listings.map(l => `
        <tr>
          <td><a href="/listings/${l.id}">${esc(l.title)}</a></td>
          <td><span class="badge badge-${esc(l.category)}">${l.category === 'give' ? 'Free' : 'Borrow'}</span></td>
          <td>${l.flag_count > 0 ? `<span style="color:#dc2626">⚑ ${l.flag_count}</span>` : '—'}</td>
          <td>
            <form method="POST" action="/dashboard/listings/${l.id}/delete" style="display:inline">
              <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
              <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Delete this listing?')">Delete</button>
            </form>
          </td>
        </tr>
      `).join('');

  const contactRows = contacts.length === 0
    ? '<p class="empty-state">No contact requests yet.</p>'
    : `<table>
        <thead><tr><th>Listing</th><th>Their contact</th><th>Message</th><th>Received</th></tr></thead>
        <tbody>
          ${contacts.map(c => `
            <tr>
              <td><a href="/listings/${c.listing_id}">${esc(c.listing_title)}</a></td>
              <td><strong>${esc(c.requester_contact)}</strong></td>
              <td>${c.message ? esc(c.message) : '<em>none</em>'}</td>
              <td style="font-size:0.8rem;color:#888">${new Date(c.created_at * 1000).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  const flash = req.session.flash ? consumeFlash(req) : null;

  const html = layout('My Dashboard', `
    <h1>My Dashboard</h1>

    <div class="card" style="margin-top:1.25rem">
      <div class="page-header">
        <h2>My Listings</h2>
        <a href="/listings/new" class="btn btn-primary btn-sm">Post new item</a>
      </div>
      ${listings.length > 0 ? `
        <table>
          <thead><tr><th>Title</th><th>Type</th><th>Flags</th><th></th></tr></thead>
          <tbody>${listingRows}</tbody>
        </table>
      ` : listingRows}
    </div>

    <div class="card" style="margin-top:1.25rem">
      <h2>Contact Requests for My Items</h2>
      <p style="font-size:0.85rem;color:#666;margin-bottom:0.75rem">Contact info is automatically deleted after 7 days.</p>
      ${contactRows}
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, flash });
  res.send(html);
});

router.post('/dashboard/listings/:id/delete', requireAuth, postLimiter, validateCsrf, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ? AND user_id = ? AND is_deleted = 0')
    .get(req.params.id, req.session.userId);
  if (!listing) return res.redirect('/dashboard');

  db.prepare('UPDATE listings SET is_deleted = 1 WHERE id = ?').run(listing.id);
  req.session.flash = { type: 'success', message: 'Listing deleted.' };
  res.redirect('/dashboard');
});

function consumeFlash(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f;
}

module.exports = router;
