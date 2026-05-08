const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { requireAuth } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { checkHoneypot } = require('../middleware/honeypot');
const { postLimiter } = require('../middleware/rateLimiter');
const { sendMail } = require('../services/mailer');
const config = require('../config');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../public/uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Browse listings (also used as HTMX partial target)
router.get('/', (req, res) => {
  const { category } = req.query;
  let listings;
  if (category === 'give' || category === 'lend') {
    listings = db.prepare(`
      SELECT l.*, u.username FROM listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.is_deleted = 0 AND l.category = ?
      ORDER BY l.created_at DESC
    `).all(category);
  } else {
    listings = db.prepare(`
      SELECT l.*, u.username FROM listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.is_deleted = 0
      ORDER BY l.created_at DESC
    `).all();
  }

  const cards = listings.length === 0
    ? '<p class="empty-state">No listings yet. Be the first to post!</p>'
    : `<div class="listing-grid">${listings.map(listingCard).join('')}</div>`;

  // HTMX partial request — return just the cards
  if (req.headers['hx-request']) {
    return res.send(cards);
  }

  const activeFilter = category || 'all';
  const html = layout('Neighborhood Listings', `
    <div class="page-header">
      <h1>Neighborhood Listings</h1>
      ${res.locals.currentUser ? '<a href="/listings/new" class="btn btn-primary">Post an Item</a>' : ''}
    </div>
    <div class="filter-bar"
         hx-target="#listing-results"
         hx-push-url="true">
      <a href="/" hx-get="/" class="${activeFilter === 'all' ? 'active' : ''}">All</a>
      <a href="/?category=give" hx-get="/?category=give" class="${activeFilter === 'give' ? 'active' : ''}">Free Stuff</a>
      <a href="/?category=lend" hx-get="/?category=lend" class="${activeFilter === 'lend' ? 'active' : ''}">Tool Library</a>
    </div>
    <div id="listing-results">
      ${cards}
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken,
       flash: req.session.flash ? consumeFlash(req) : null });
  res.send(html);
});

// New listing form
router.get('/listings/new', requireAuth, (req, res) => {
  const html = layout('Post an Item', `
    <div class="card" style="max-width:560px;margin:0 auto">
      <h1>Post an Item</h1>
      <form method="POST" action="/listings" enctype="multipart/form-data">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="hp-field"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field">
          <label for="title">Title</label>
          <input type="text" id="title" name="title" required maxlength="120">
        </div>
        <div class="field">
          <label for="category">Type</label>
          <select id="category" name="category" required>
            <option value="give">Free to take</option>
            <option value="lend">Available to borrow</option>
          </select>
        </div>
        <div class="field">
          <label for="description">Description</label>
          <textarea id="description" name="description" maxlength="2000"></textarea>
        </div>
        <div class="field">
          <label for="photo">Photo (optional, max 5 MB)</label>
          <input type="file" id="photo" name="photo" accept="image/*">
        </div>
        ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
        <button type="submit" class="btn btn-primary">Post Item</button>
        <a href="/" class="btn btn-secondary" style="margin-left:0.5rem">Cancel</a>
      </form>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken });
  res.send(html);
});

// Create listing
router.post('/listings', requireAuth, postLimiter, upload.single('photo'), validateCsrf, checkHoneypot, (req, res) => {
  const { title, category, description } = req.body;
  if (!title || !title.trim()) {
    return res.redirect('/listings/new?error=Title+is+required');
  }
  if (!['give', 'lend'].includes(category)) {
    return res.redirect('/listings/new?error=Invalid+category');
  }

  const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
  const now = Math.floor(Date.now() / 1000);

  const result = db.prepare(`
    INSERT INTO listings (user_id, title, description, category, photo_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.session.userId, title.trim(), (description || '').trim(), category, photoPath, now);

  req.session.flash = { type: 'success', message: 'Your item has been posted!' };
  res.redirect(`/listings/${result.lastInsertRowid}`);
});

// View single listing
router.get('/listings/:id', (req, res) => {
  const listing = db.prepare(`
    SELECT l.*, u.username FROM listings l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ? AND l.is_deleted = 0
  `).get(req.params.id);

  if (!listing) {
    return res.status(404).send(layout('Not Found', `
      <div class="card"><h1>Listing not found</h1><p><a href="/">Back to listings</a></p></div>
    `, { currentUser: res.locals.currentUser }));
  }

  const isOwner = res.locals.currentUser && res.locals.currentUser.id === listing.user_id;
  const flash = req.session.flash ? consumeFlash(req) : null;

  const html = layout(esc(listing.title), `
    <div style="max-width:640px;margin:0 auto">
      <p style="margin-bottom:0.75rem"><a href="/">← All listings</a></p>
      ${listing.photo_path ? `<img src="${esc(listing.photo_path)}" alt="" style="width:100%;border-radius:8px;margin-bottom:1rem;max-height:400px;object-fit:cover">` : ''}
      <div class="card">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
          <span class="badge badge-${esc(listing.category)}">${listing.category === 'give' ? 'Free to take' : 'Available to borrow'}</span>
          <span style="color:#888;font-size:0.85rem">Posted by ${esc(listing.username)} · ${timeAgo(listing.created_at)}</span>
        </div>
        <h1>${esc(listing.title)}</h1>
        ${listing.description ? `<p style="margin-top:0.75rem;white-space:pre-wrap">${esc(listing.description)}</p>` : ''}
        <div style="margin-top:1.25rem;display:flex;gap:0.5rem;flex-wrap:wrap">
          ${res.locals.currentUser && !isOwner ? `<a href="/contact/${listing.id}" class="btn btn-primary">Contact about this item</a>` : ''}
          ${!res.locals.currentUser ? `<a href="/login" class="btn btn-primary">Login to contact</a>` : ''}
          ${res.locals.currentUser && !isOwner ? `
            <form method="POST" action="/listings/${listing.id}/flag" style="display:inline">
              <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
              <button type="submit" class="btn btn-secondary btn-sm" onclick="return confirm('Flag this listing as inappropriate?')">Flag</button>
            </form>
          ` : ''}
          ${isOwner ? '<span style="color:#888;font-size:0.9rem">This is your listing</span>' : ''}
        </div>
      </div>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, flash });
  res.send(html);
});

// Flag a listing
router.post('/listings/:id/flag', requireAuth, postLimiter, validateCsrf, async (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!listing) return res.redirect('/');

  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO flags (listing_id, flagged_by, reason, created_at) VALUES (?, ?, ?, ?)')
    .run(listing.id, req.session.userId, req.body.reason || null, now);
  db.prepare('UPDATE listings SET flag_count = flag_count + 1 WHERE id = ?').run(listing.id);

  await sendMail({
    to: config.adminEmail,
    subject: `[MSB Stuff] Listing flagged: ${listing.title}`,
    text: `Listing #${listing.id} "${listing.title}" was flagged.\nReview at /admin`,
  });

  req.session.flash = { type: 'info', message: 'Thanks — this listing has been flagged for review.' };
  res.redirect(`/listings/${listing.id}`);
});

function listingCard(l) {
  const photo = l.photo_path
    ? `<img src="${esc(l.photo_path)}" alt="${esc(l.title)}" loading="lazy">`
    : `<div style="height:120px;background:#e8e8e0;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:2rem">📦</div>`;
  return `
    <div class="listing-card">
      <a href="/listings/${l.id}">${photo}</a>
      <div class="card-body">
        <div><span class="badge badge-${esc(l.category)}">${l.category === 'give' ? 'Free' : 'Borrow'}</span></div>
        <p class="card-title"><a href="/listings/${l.id}" style="text-decoration:none;color:inherit">${esc(l.title)}</a></p>
        <p class="card-meta">by ${esc(l.username)} · ${timeAgo(l.created_at)}</p>
        <div class="card-actions">
          <a href="/listings/${l.id}" class="btn btn-secondary btn-sm">View</a>
        </div>
      </div>
    </div>`;
}

function timeAgo(ts) {
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function consumeFlash(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f;
}

module.exports = router;
