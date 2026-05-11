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

// Fetch all tags with optional active set for rendering
function getAllTags() {
  return db.prepare('SELECT * FROM tags ORDER BY name').all();
}

// Fetch tag IDs for a listing
function getListingTagIds(listingId) {
  return db.prepare('SELECT tag_id FROM listing_tags WHERE listing_id = ?')
    .all(listingId).map(r => r.tag_id);
}

// Fetch full tags for a listing
function getListingTags(listingId) {
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN listing_tags lt ON lt.tag_id = t.id
    WHERE lt.listing_id = ?
    ORDER BY t.name
  `).all(listingId);
}

// Render inline tag pills
function renderTags(tags) {
  if (!tags || tags.length === 0) return '';
  return tags.map(t =>
    `<span class="tag" style="background:${esc(t.color)}">${esc(t.name)}</span>`
  ).join(' ');
}

// Render tag filter bar (HTMX-driven)
function renderTagFilters(allTags, activeTagIds) {
  const allActive = activeTagIds.length === 0;
  const clearUrl = '/';
  const toggles = allTags.map(t => {
    const isActive = activeTagIds.includes(t.id);
    // Build new tag set with this tag toggled
    const newSet = isActive
      ? activeTagIds.filter(id => id !== t.id)
      : [...activeTagIds, t.id];
    const url = newSet.length === 0 ? '/' : `/?tags=${newSet.join(',')}`;
    return `<a href="${esc(url)}"
        hx-get="${esc(url)}"
        hx-target="#listing-results"
        hx-push-url="true"
        class="tag-filter-toggle${isActive ? ' active' : ''}"
        style="background:${esc(t.color)}"
      >${esc(t.name)}</a>`;
  }).join('');

  return `<div class="tag-filters">
    <a href="${esc(clearUrl)}"
       hx-get="${esc(clearUrl)}"
       hx-target="#listing-results"
       hx-push-url="true"
       class="tag-filter-all${allActive ? ' active' : ''}"
    >All</a>
    ${toggles}
  </div>`;
}

// Browse listings
router.get('/', (req, res) => {
  const allTags = getAllTags();

  // Parse ?tags=1,2,3
  const activeTagIds = (req.query.tags || '')
    .split(',')
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n) && n > 0);

  let listings;
  if (activeTagIds.length > 0) {
    const placeholders = activeTagIds.map(() => '?').join(',');
    listings = db.prepare(`
      SELECT DISTINCT l.*, u.username FROM listings l
      JOIN users u ON l.user_id = u.id
      JOIN listing_tags lt ON lt.listing_id = l.id
      WHERE l.is_deleted = 0 AND lt.tag_id IN (${placeholders})
      ORDER BY l.created_at DESC
    `).all(...activeTagIds);
  } else {
    listings = db.prepare(`
      SELECT l.*, u.username FROM listings l
      JOIN users u ON l.user_id = u.id
      WHERE l.is_deleted = 0
      ORDER BY l.created_at DESC
    `).all();
  }

  // Attach tags to each listing
  const listingsWithTags = listings.map(l => ({
    ...l,
    tags: getListingTags(l.id),
  }));

  const cards = listingsWithTags.length === 0
    ? '<p class="empty-state">No listings yet. Be the first to post!</p>'
    : `<div class="listing-grid">${listingsWithTags.map(listingCard).join('')}</div>`;

  // HTMX partial request — return just the cards
  if (req.headers['hx-request']) {
    return res.send(cards);
  }

  const flash = req.session.flash ? consumeFlash(req) : null;

  const html = layout('Listings', `
    <div class="page-header">
      <h1>Listings</h1>
      ${res.locals.currentUser ? '<a href="/listings/new" class="btn btn-primary">Post an Item</a>' : ''}
    </div>
    ${renderTagFilters(allTags, activeTagIds)}
    <div id="listing-results">
      ${cards}
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, flash });
  res.send(html);
});

// New listing form
router.get('/listings/new', requireAuth, (req, res) => {
  const allTags = getAllTags();
  const tagCheckboxes = allTags.length === 0
    ? '<p style="color:var(--text-muted);font-size:0.9rem">No tags yet — an admin can create them at <a href="/admin/tags">Admin → Tags</a>.</p>'
    : `<div class="tag-checkbox-group" id="tag-checkboxes">
        ${allTags.map(t => `
          <label class="tag-checkbox-label" style="background:${esc(t.color)}" data-id="${t.id}">
            <input type="checkbox" name="tags" value="${t.id}">
            ${esc(t.name)}
          </label>
        `).join('')}
       </div>
       <script>
         document.querySelectorAll('.tag-checkbox-label').forEach(lbl => {
           lbl.querySelector('input').addEventListener('change', function() {
             lbl.classList.toggle('checked', this.checked);
           });
         });
       </script>`;

  const html = layout('Post an Item', `
    <div class="card" style="max-width:580px;margin:0 auto">
      <h1>Post an Item</h1>
      <form method="POST" action="/listings" enctype="multipart/form-data">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="hp-field"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field">
          <label for="title">Title</label>
          <input type="text" id="title" name="title" required maxlength="120">
        </div>
        <div class="field">
          <label>Tags</label>
          ${tagCheckboxes}
          <p class="hint">Select any that apply.</p>
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
        <div style="display:flex;gap:0.5rem;margin-top:0.25rem">
          <button type="submit" class="btn btn-primary">Post Item</button>
          <a href="/" class="btn btn-secondary">Cancel</a>
        </div>
      </form>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken });
  res.send(html);
});

// Create listing
router.post('/listings', requireAuth, postLimiter, upload.single('photo'), validateCsrf, checkHoneypot, (req, res) => {
  const { title, description } = req.body;
  if (!title || !title.trim()) {
    return res.redirect('/listings/new?error=Title+is+required');
  }

  // Parse submitted tag IDs
  let tagIds = [];
  if (req.body.tags) {
    tagIds = (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags])
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id) && id > 0);
    // Validate all IDs exist
    const validIds = db.prepare(
      `SELECT id FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')})`
    ).all(...tagIds).map(r => r.id);
    tagIds = validIds;
  }

  const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
  const now = Math.floor(Date.now() / 1000);

  const result = db.prepare(`
    INSERT INTO listings (user_id, title, description, photo_path, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.session.userId, title.trim(), (description || '').trim(), photoPath, now);

  const listingId = result.lastInsertRowid;
  if (tagIds.length > 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO listing_tags (listing_id, tag_id) VALUES (?, ?)');
    for (const tagId of tagIds) insertTag.run(listingId, tagId);
  }

  req.session.flash = { type: 'success', message: 'Your item has been posted!' };
  res.redirect(`/listings/${listingId}`);
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

  const listingTags = getListingTags(listing.id);
  const isOwner = res.locals.currentUser && res.locals.currentUser.id === listing.user_id;
  const flash = req.session.flash ? consumeFlash(req) : null;

  const html = layout(esc(listing.title), `
    <div style="max-width:660px;margin:0 auto">
      <p style="margin-bottom:0.75rem"><a href="/">← All listings</a></p>
      ${listing.photo_path
        ? `<img src="${esc(listing.photo_path)}" alt="" style="width:100%;border-radius:10px;margin-bottom:1rem;max-height:420px;object-fit:cover">`
        : ''}
      <div class="card">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.65rem;flex-wrap:wrap">
          ${renderTags(listingTags)}
          <span style="color:var(--text-muted);font-size:0.85rem">
            Posted by ${esc(listing.username)} · ${timeAgo(listing.created_at)}
          </span>
        </div>
        <h1>${esc(listing.title)}</h1>
        ${listing.description
          ? `<p style="margin-top:0.75rem;white-space:pre-wrap;color:var(--text)">${esc(listing.description)}</p>`
          : ''}
        <div style="margin-top:1.25rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
          ${res.locals.currentUser && !isOwner
            ? `<a href="/contact/${listing.id}" class="btn btn-primary">Contact about this item</a>`
            : ''}
          ${!res.locals.currentUser
            ? `<a href="/login" class="btn btn-primary">Login to contact</a>`
            : ''}
          ${res.locals.currentUser && !isOwner ? `
            <form method="POST" action="/listings/${listing.id}/flag" style="display:inline">
              <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
              <button type="submit" class="btn btn-secondary btn-sm"
                onclick="return confirm('Flag this listing as inappropriate?')">Flag</button>
            </form>
          ` : ''}
          ${isOwner ? '<span style="color:var(--text-muted);font-size:0.9rem">This is your listing</span>' : ''}
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
    subject: `[msb's stuff sharer] Listing flagged: ${listing.title}`,
    text: `Listing #${listing.id} "${listing.title}" was flagged.\nReview at /admin`,
  });

  req.session.flash = { type: 'info', message: 'Thanks — this listing has been flagged for review.' };
  res.redirect(`/listings/${listing.id}`);
});

// ── Helpers ─────────────────────────────────────────────

function listingCard(l) {
  const photo = l.photo_path
    ? `<img src="${esc(l.photo_path)}" alt="${esc(l.title)}" loading="lazy">`
    : `<div class="card-placeholder">📦</div>`;
  return `
    <div class="listing-card">
      <a href="/listings/${l.id}">${photo}</a>
      <div class="card-body">
        ${l.tags && l.tags.length > 0 ? `<div class="card-tags">${renderTags(l.tags)}</div>` : ''}
        <p class="card-title"><a href="/listings/${l.id}">${esc(l.title)}</a></p>
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
