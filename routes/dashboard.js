const express = require('express');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { t } = require('../i18n/strings');
const { requireAuth } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { postLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

function getListingTags(listingId) {
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN listing_tags lt ON lt.tag_id = t.id
    WHERE lt.listing_id = ?
    ORDER BY t.name
  `).all(listingId);
}

function renderTags(tags, lang) {
  if (!tags || tags.length === 0) {
    return `<em style="color:var(--text-muted);font-size:0.8rem">${t('misc.no_tags', lang)}</em>`;
  }
  return tags.map(tag =>
    `<span class="tag" style="background:${esc(tag.color)}">${esc(tag.name)}</span>`
  ).join(' ');
}

router.get('/dashboard', requireAuth, (req, res) => {
  const lang = res.locals.lang;

  const listings = db.prepare(
    'SELECT * FROM listings WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC'
  ).all(req.session.userId);

  const contacts = db.prepare(`
    SELECT cr.*, l.title as listing_title, l.id as listing_id
    FROM contact_requests cr
    JOIN listings l ON cr.listing_id = l.id
    WHERE l.user_id = ? AND l.is_deleted = 0
    ORDER BY cr.created_at DESC
  `).all(req.session.userId);

  const listingRowsHtml = listings.length === 0
    ? `<p class="empty-state">${t('dash.empty', lang)} <a href="/listings/new">${t('dash.post_link', lang)}</a></p>`
    : `<table>
        <thead><tr>
          <th>${t('dash.col_title', lang)}</th>
          <th>${t('dash.col_tags', lang)}</th>
          <th>${t('dash.col_flags', lang)}</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${listings.map(l => {
            const tags = getListingTags(l.id);
            return `<tr>
              <td><a href="/listings/${l.id}">${esc(l.title)}</a></td>
              <td>${renderTags(tags, lang)}</td>
              <td>${l.flag_count > 0 ? `<span style="color:#c0392b">⚑ ${l.flag_count}</span>` : '—'}</td>
              <td>
                <form method="POST" action="/dashboard/listings/${l.id}/delete" style="display:inline">
                  <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
                  <button type="submit" class="btn btn-danger btn-sm"
                    onclick="return confirm('${t('dash.delete_confirm', lang)}')">${t('dash.delete', lang)}</button>
                </form>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

  const contactsHtml = contacts.length === 0
    ? `<p class="empty-state">${t('dash.no_contacts', lang)}</p>`
    : `<table>
        <thead><tr>
          <th>${t('dash.col_listing', lang)}</th>
          <th>${t('dash.col_their_contact', lang)}</th>
          <th>${t('dash.col_message', lang)}</th>
          <th>${t('dash.col_received', lang)}</th>
        </tr></thead>
        <tbody>
          ${contacts.map(c => `
            <tr>
              <td><a href="/listings/${c.listing_id}">${esc(c.listing_title)}</a></td>
              <td><strong>${esc(c.requester_contact)}</strong></td>
              <td>${c.message ? esc(c.message) : `<em>${t('misc.none', lang)}</em>`}</td>
              <td style="font-size:0.8rem;color:var(--text-muted)">${new Date(c.created_at * 1000).toLocaleDateString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  const flash = req.session.flash ? consumeFlash(req) : null;

  const html = layout(t('dash.title', lang), `
    <h1>${t('dash.title', lang)}</h1>
    <div class="card" style="margin-top:1.25rem">
      <div class="page-header">
        <h2>${t('dash.my_listings', lang)}</h2>
        <a href="/listings/new" class="btn btn-primary btn-sm">${t('dash.post_new', lang)}</a>
      </div>
      ${listingRowsHtml}
    </div>
    <div class="card" style="margin-top:1.25rem">
      <h2>${t('dash.contacts', lang)}</h2>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem">
        ${t('dash.contacts_note', lang)}
      </p>
      ${contactsHtml}
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang, flash });
  res.send(html);
});

router.post('/dashboard/listings/:id/delete', requireAuth, postLimiter, validateCsrf, (req, res) => {
  const listing = db.prepare(
    'SELECT * FROM listings WHERE id = ? AND user_id = ? AND is_deleted = 0'
  ).get(req.params.id, req.session.userId);

  if (!listing) return res.redirect('/dashboard');
  db.prepare('UPDATE listings SET is_deleted = 1 WHERE id = ?').run(listing.id);
  req.session.flash = { type: 'success', key: 'flash.listing_deleted' };
  res.redirect('/dashboard');
});

function consumeFlash(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f;
}

module.exports = router;
