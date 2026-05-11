const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { t } = require('../i18n/strings');
const { requireAuth } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { checkHoneypot } = require('../middleware/honeypot');
const { postLimiter } = require('../middleware/rateLimiter');
const { sendMail } = require('../services/mailer');
const { getListingTranslation, translateTags } = require('../services/translator');
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

function getAllTags() {
  return db.prepare('SELECT * FROM tags ORDER BY name').all();
}

function getListingTags(listingId) {
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN listing_tags lt ON lt.tag_id = t.id
    WHERE lt.listing_id = ?
    ORDER BY t.name
  `).all(listingId);
}

function renderTags(tags) {
  if (!tags || tags.length === 0) return '';
  return tags.map(t => {
    const translated = t.translatedName && t.translatedName !== t.name
      ? `<span class="auto-translation">${esc(t.translatedName)}</span>`
      : '';
    return `<span class="tag" style="background:${esc(t.color)}">${esc(t.name)}${translated}</span>`;
  }).join(' ');
}

function timeAgo(ts, lang) {
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60)   return t('time.just_now', lang);
  if (secs < 3600) return t('time.minutes', lang, { n: Math.floor(secs / 60) });
  if (secs < 86400) return t('time.hours', lang, { n: Math.floor(secs / 3600) });
  return t('time.days', lang, { n: Math.floor(secs / 86400) });
}

function renderTagFilters(allTags, activeTagIds, lang) {
  const allActive = activeTagIds.length === 0;
  const toggles = allTags.map(tag => {
    const isActive = activeTagIds.includes(tag.id);
    const newSet = isActive
      ? activeTagIds.filter(id => id !== tag.id)
      : [...activeTagIds, tag.id];
    const url = newSet.length === 0 ? '/' : `/?tags=${newSet.join(',')}`;
    return `<a href="${esc(url)}"
        hx-get="${esc(url)}" hx-target="#listing-results" hx-push-url="true"
        class="tag-filter-toggle${isActive ? ' active' : ''}"
        style="background:${esc(tag.color)}"
      >${esc(tag.name)}</a>`;
  }).join('');

  return `<div class="tag-filters">
    <a href="/" hx-get="/" hx-target="#listing-results" hx-push-url="true"
       class="tag-filter-all${allActive ? ' active' : ''}"
    >${t('browse.filter_all', lang)}</a>
    ${toggles}
  </div>`;
}

// Browse listings
router.get('/', async (req, res) => {
  const lang = res.locals.lang;
  const allTags = getAllTags();

  const activeTagIds = (req.query.tags || '')
    .split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n > 0);

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

  // Fetch tags + translations for each listing in parallel
  const listingsWithData = await Promise.all(listings.map(async l => {
    const tags = await translateTags(getListingTags(l.id), lang);
    const xlat = await getListingTranslation(l, lang);
    return { ...l, tags, xlat };
  }));

  const cards = listingsWithData.length === 0
    ? `<p class="empty-state">${t('browse.empty', lang)}</p>`
    : `<div class="listing-grid">${listingsWithData.map(l => listingCard(l, lang)).join('')}</div>`;

  if (req.headers['hx-request']) return res.send(cards);

  const flash = req.session.flash ? consumeFlash(req) : null;
  const html = layout(t('browse.title', lang), `
    <div class="page-header">
      <h1>${t('browse.title', lang)}</h1>
      ${res.locals.currentUser ? `<a href="/listings/new" class="btn btn-primary">${t('browse.post_btn', lang)}</a>` : ''}
    </div>
    ${renderTagFilters(allTags, activeTagIds, lang)}
    <div id="listing-results">${cards}</div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang, flash });
  res.send(html);
});

// New listing form
router.get('/listings/new', requireAuth, (req, res) => {
  const lang = res.locals.lang;
  const allTags = getAllTags();

  const tagCheckboxes = allTags.length === 0
    ? `<p style="color:var(--text-muted);font-size:0.9rem">${t('post.no_tags', lang)}</p>`
    : `<div class="tag-checkbox-group" id="tag-checkboxes">
        ${allTags.map(tag => `
          <label class="tag-checkbox-label" style="background:${esc(tag.color)}" data-id="${tag.id}">
            <input type="checkbox" name="tags" value="${tag.id}">
            ${esc(tag.name)}
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

  const html = layout(t('post.title', lang), `
    <div class="card" style="max-width:580px;margin:0 auto">
      <h1>${t('post.title', lang)}</h1>
      <form method="POST" action="/listings" enctype="multipart/form-data">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="hp-field"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field">
          <label for="title">${t('post.label_title', lang)}</label>
          <input type="text" id="title" name="title" required maxlength="120">
        </div>
        <div class="field">
          <label>${t('post.label_tags', lang)}</label>
          ${tagCheckboxes}
          <p class="hint">${t('post.tags_hint', lang)}</p>
        </div>
        <div class="field">
          <label for="description">${t('post.label_desc', lang)}</label>
          <textarea id="description" name="description" maxlength="2000"></textarea>
        </div>
        <div class="field">
          <label for="photo">${t('post.label_photo', lang)}</label>
          <input type="file" id="photo" name="photo" accept="image/*">
        </div>
        ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
        <div style="display:flex;gap:0.5rem;margin-top:0.25rem">
          <button type="submit" class="btn btn-primary">${t('post.submit', lang)}</button>
          <a href="/" class="btn btn-secondary">${t('post.cancel', lang)}</a>
        </div>
      </form>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang });
  res.send(html);
});

// Create listing
router.post('/listings', requireAuth, postLimiter, upload.single('photo'), validateCsrf, checkHoneypot, (req, res) => {
  const { title, description } = req.body;
  const lang = res.locals.lang;

  if (!title || !title.trim()) {
    return res.redirect(`/listings/new?error=${encodeURIComponent(t('post.label_title', lang) + ' required')}`);
  }

  let tagIds = [];
  if (req.body.tags) {
    const raw = Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags];
    tagIds = raw.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
    if (tagIds.length > 0) {
      const validIds = db.prepare(
        `SELECT id FROM tags WHERE id IN (${tagIds.map(() => '?').join(',')})`
      ).all(...tagIds).map(r => r.id);
      tagIds = validIds;
    }
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

  // Kick off language detection asynchronously (don't await — don't block the response)
  const { detectAndTranslate } = require('../services/translator');
  detectAndTranslate(title.trim(), 'en').then(result => {
    if (result?.detectedSource) {
      db.prepare('UPDATE listings SET detected_lang = ? WHERE id = ?')
        .run(result.detectedSource, listingId);
    }
  }).catch(() => {});

  req.session.flash = { type: 'success', key: 'flash.item_posted' };
  res.redirect(`/listings/${listingId}`);
});

// View single listing
router.get('/listings/:id', async (req, res) => {
  const lang = res.locals.lang;
  const listing = db.prepare(`
    SELECT l.*, u.username FROM listings l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ? AND l.is_deleted = 0
  `).get(req.params.id);

  if (!listing) {
    return res.status(404).send(layout(t('listing.not_found', lang), `
      <div class="card">
        <h1>${t('listing.not_found', lang)}</h1>
        <p><a href="/">${t('listing.back_to_all', lang)}</a></p>
      </div>
    `, { currentUser: res.locals.currentUser, lang }));
  }

  const [listingTags, xlat] = await Promise.all([
    translateTags(getListingTags(listing.id), lang),
    getListingTranslation(listing, lang),
  ]);

  const isOwner = res.locals.currentUser && res.locals.currentUser.id === listing.user_id;
  const flash = req.session.flash ? consumeFlash(req) : null;

  const titleHtml = xlat?.title && xlat.title !== listing.title
    ? `${esc(listing.title)}<span class="auto-translation">${esc(xlat.title)}</span>`
    : esc(listing.title);

  const descHtml = listing.description
    ? (xlat?.description && xlat.description !== listing.description
        ? `${esc(listing.description)}<span class="auto-translation"> ${esc(xlat.description)}</span>`
        : esc(listing.description))
    : '';

  const html = layout(listing.title, `
    <div style="max-width:660px;margin:0 auto">
      <p style="margin-bottom:0.75rem"><a href="/">${t('listing.back', lang)}</a></p>
      ${listing.photo_path
        ? `<img src="${esc(listing.photo_path)}" alt="" style="width:100%;border-radius:10px;margin-bottom:1rem;max-height:420px;object-fit:cover">`
        : ''}
      <div class="card">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.65rem;flex-wrap:wrap">
          ${renderTags(listingTags)}
          <span style="color:var(--text-muted);font-size:0.85rem">
            ${t('listing.posted_by', lang)} ${esc(listing.username)} · ${timeAgo(listing.created_at, lang)}
          </span>
        </div>
        <h1>${titleHtml}</h1>
        ${descHtml ? `<p style="margin-top:0.75rem;white-space:pre-wrap">${descHtml}</p>` : ''}
        <div style="margin-top:1.25rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
          ${res.locals.currentUser && !isOwner
            ? `<a href="/contact/${listing.id}" class="btn btn-primary">${t('listing.contact_btn', lang)}</a>`
            : ''}
          ${!res.locals.currentUser
            ? `<a href="/login" class="btn btn-primary">${t('listing.login_contact', lang)}</a>`
            : ''}
          ${res.locals.currentUser && !isOwner ? `
            <form method="POST" action="/listings/${listing.id}/flag" style="display:inline">
              <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
              <button type="submit" class="btn btn-secondary btn-sm"
                onclick="return confirm('${t('listing.flag_confirm', lang)}')">${t('listing.flag', lang)}</button>
            </form>
          ` : ''}
          ${isOwner ? `<span style="color:var(--text-muted);font-size:0.9rem">${t('listing.yours', lang)}</span>` : ''}
        </div>
      </div>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang, flash });
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

  req.session.flash = { type: 'info', key: 'flash.flagged' };
  res.redirect(`/listings/${listing.id}`);
});

// ── Helpers ────────────────────────────────────────────────

function listingCard(l, lang) {
  const photo = l.photo_path
    ? `<img src="${esc(l.photo_path)}" alt="${esc(l.title)}" loading="lazy">`
    : `<div class="card-placeholder">📦</div>`;

  // Show faded translation in card title if available
  const titleHtml = l.xlat?.title && l.xlat.title !== l.title
    ? `${esc(l.title)}<span class="auto-translation">${esc(l.xlat.title)}</span>`
    : esc(l.title);

  return `
    <div class="listing-card">
      <a href="/listings/${l.id}">${photo}</a>
      <div class="card-body">
        ${l.tags && l.tags.length > 0 ? `<div class="card-tags">${renderTags(l.tags)}</div>` : ''}
        <p class="card-title"><a href="/listings/${l.id}">${titleHtml}</a></p>
        <p class="card-meta">${t('listing.posted_by', lang)} ${esc(l.username)} · ${timeAgo(l.created_at, lang)}</p>
        <div class="card-actions">
          <a href="/listings/${l.id}" class="btn btn-secondary btn-sm">${t('browse.view', lang)}</a>
        </div>
      </div>
    </div>`;
}

function consumeFlash(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f;
}

module.exports = router;
