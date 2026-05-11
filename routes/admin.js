const express = require('express');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { t } = require('../i18n/strings');
const { requireAdmin } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { postLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/admin', requireAdmin, (req, res) => {
  const lang = res.locals.lang;

  const flagged = db.prepare(`
    SELECT l.*, u.username,
      (SELECT COUNT(*) FROM flags f WHERE f.listing_id = l.id) as flag_count
    FROM listings l JOIN users u ON l.user_id = u.id
    WHERE l.is_deleted = 0 AND l.flag_count > 0
    ORDER BY l.flag_count DESC, l.created_at DESC
  `).all();

  const allListings = db.prepare(`
    SELECT l.*, u.username FROM listings l JOIN users u ON l.user_id = u.id
    WHERE l.is_deleted = 0 ORDER BY l.created_at DESC LIMIT 50
  `).all();

  const users = db.prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC').all();
  const flash = req.session.flash ? consumeFlash(req) : null;

  const actionBtns = (id) => `
    <form method="POST" action="/admin/listings/${id}/delete" style="display:inline">
      <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
      <button type="submit" class="btn btn-danger btn-sm"
        onclick="return confirm('${t('misc.delete_confirm', lang)}')">${t('misc.delete', lang)}</button>
    </form>`;

  const flaggedRows = flagged.map(l => `
    <tr>
      <td><a href="/listings/${l.id}">${esc(l.title)}</a></td>
      <td>${esc(l.username)}</td>
      <td style="color:#c0392b;font-weight:600">${l.flag_count}</td>
      <td style="display:flex;gap:0.4rem;flex-wrap:wrap">
        ${actionBtns(l.id)}
        <form method="POST" action="/admin/listings/${l.id}/unflag" style="display:inline">
          <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
          <button type="submit" class="btn btn-secondary btn-sm">${t('admin.clear_flags', lang)}</button>
        </form>
      </td>
    </tr>`).join('');

  const listingRows = allListings.map(l => `
    <tr>
      <td><a href="/listings/${l.id}">${esc(l.title)}</a></td>
      <td>${esc(l.username)}</td>
      <td>${actionBtns(l.id)}</td>
    </tr>`).join('');

  const userRows = users.map(u => `
    <tr>
      <td>${esc(u.username)}</td>
      <td>${u.is_admin ? `<strong>${t('admin.role_admin', lang)}</strong>` : t('admin.role_neighbor', lang)}</td>
      <td style="font-size:0.85rem;color:var(--text-muted)">${new Date(u.created_at * 1000).toLocaleDateString()}</td>
    </tr>`).join('');

  const html = layout(t('admin.title', lang), `
    <div class="page-header">
      <h1>${t('admin.title', lang)}</h1>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <a href="/admin/tags" class="btn btn-secondary btn-sm">${t('admin.manage_tags', lang)}</a>
        <a href="/admin/invite" class="btn btn-primary btn-sm">${t('admin.invite_links', lang)}</a>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.25rem">
      <h2 style="margin-bottom:0.75rem">${t('admin.flagged', lang)}</h2>
      ${flagged.length > 0
        ? `<table><thead><tr>
            <th>${t('dash.col_title', lang)}</th>
            <th>${t('admin.col_posted_by', lang)}</th>
            <th>${t('admin.col_flags', lang)}</th>
            <th>${t('admin.col_actions', lang)}</th>
           </tr></thead><tbody>${flaggedRows}</tbody></table>`
        : `<p class="empty-state">${t('admin.no_flagged', lang)}</p>`}
    </div>

    <div class="card" style="margin-bottom:1.25rem">
      <h2 style="margin-bottom:0.75rem">${t('admin.all_listings', lang)}</h2>
      ${allListings.length > 0
        ? `<table><thead><tr>
            <th>${t('dash.col_title', lang)}</th>
            <th>${t('admin.col_posted_by', lang)}</th>
            <th>${t('admin.col_actions', lang)}</th>
           </tr></thead><tbody>${listingRows}</tbody></table>`
        : `<p class="empty-state">${t('admin.no_listings', lang)}</p>`}
    </div>

    <div class="card">
      <h2 style="margin-bottom:0.75rem">${t('admin.neighbors', lang)}</h2>
      <table><thead><tr>
        <th>${t('admin.col_username', lang)}</th>
        <th>${t('admin.col_role', lang)}</th>
        <th>${t('admin.col_joined', lang)}</th>
      </tr></thead><tbody>${userRows}</tbody></table>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang, flash });
  res.send(html);
});

router.post('/admin/listings/:id/delete', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  db.prepare('UPDATE listings SET is_deleted = 1 WHERE id = ?').run(req.params.id);
  req.session.flash = { type: 'success', key: 'flash.listing_deleted' };
  res.redirect('/admin');
});

router.post('/admin/listings/:id/unflag', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  db.prepare('UPDATE listings SET flag_count = 0 WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM flags WHERE listing_id = ?').run(req.params.id);
  req.session.flash = { type: 'success', key: 'flash.flags_cleared' };
  res.redirect('/admin');
});

// ── Tag management ────────────────────────────────────────

router.get('/admin/tags', requireAdmin, (req, res) => {
  const lang = res.locals.lang;
  const tags = db.prepare(`
    SELECT t.*, u.username as creator,
      (SELECT COUNT(*) FROM listing_tags lt WHERE lt.tag_id = t.id) as usage_count
    FROM tags t JOIN users u ON t.created_by = u.id
    ORDER BY t.name
  `).all();

  const flash = req.session.flash ? consumeFlash(req) : null;

  const rows = tags.map(tag => `
    <tr>
      <td><span class="tag" style="background:${esc(tag.color)}">${esc(tag.name)}</span></td>
      <td><code>${esc(tag.color)}</code></td>
      <td>${tag.usage_count}</td>
      <td>${esc(tag.creator)}</td>
      <td>
        <form method="POST" action="/admin/tags/${tag.id}/delete"
              onsubmit="return confirm('${t('tags.delete_confirm', lang, { name: tag.name })}')">
          <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
          <button type="submit" class="btn btn-danger btn-sm">${t('tags.delete', lang)}</button>
        </form>
      </td>
    </tr>`).join('');

  const html = layout(t('tags.title', lang), `
    <div class="page-header">
      <h1>${t('tags.title', lang)}</h1>
      <a href="/admin" class="btn btn-secondary btn-sm">${t('tags.back', lang)}</a>
    </div>
    <div class="card" style="max-width:480px;margin-bottom:1.5rem">
      <h2>${t('tags.create', lang)}</h2>
      <form method="POST" action="/admin/tags">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="field">
          <label for="tag-name">${t('tags.label_name', lang)}</label>
          <input type="text" id="tag-name" name="name" required maxlength="40"
                 placeholder="${t('tags.placeholder', lang)}">
        </div>
        <div class="field">
          <label for="tag-color">${t('tags.label_color', lang)}</label>
          <div style="display:flex;gap:0.75rem;align-items:center">
            <input type="color" id="tag-color" name="color" value="#4A8469" style="width:4rem">
            <span style="font-size:0.875rem;color:var(--text-muted)">${t('tags.color_hint', lang)}</span>
          </div>
        </div>
        ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
        <button type="submit" class="btn btn-primary">${t('tags.submit', lang)}</button>
      </form>
    </div>
    <div class="card">
      <h2 style="margin-bottom:0.75rem">${t('tags.all', lang)}</h2>
      ${tags.length === 0
        ? `<p class="empty-state">${t('tags.none', lang)}</p>`
        : `<table>
            <thead><tr>
              <th>${t('tags.col_tag', lang)}</th>
              <th>${t('tags.col_color', lang)}</th>
              <th>${t('tags.col_used', lang)}</th>
              <th>${t('tags.col_created_by', lang)}</th>
              <th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`}
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang, flash });
  res.send(html);
});

router.post('/admin/tags', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  const { name, color } = req.body;
  const lang = res.locals.lang;
  if (!name || !name.trim()) return res.redirect('/admin/tags?error=Tag+name+required');
  const sanitizedColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#888888';
  if (db.prepare('SELECT id FROM tags WHERE name = ?').get(name.trim())) {
    return res.redirect('/admin/tags?error=Tag+name+already+exists');
  }
  db.prepare('INSERT INTO tags (name, color, created_by, created_at) VALUES (?, ?, ?, ?)')
    .run(name.trim(), sanitizedColor, req.session.userId, Math.floor(Date.now() / 1000));
  req.session.flash = { type: 'success', key: 'flash.tag_created', params: { name: name.trim() } };
  res.redirect('/admin/tags');
});

router.post('/admin/tags/:id/delete', requireAdmin, postLimiter, validateCsrf, (req, res) => {
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.redirect('/admin/tags');
  // Also purge cached translations for this tag
  db.prepare('DELETE FROM tag_translations WHERE tag_id = ?').run(tag.id);
  db.prepare('DELETE FROM listing_tags WHERE tag_id = ?').run(tag.id);
  db.prepare('DELETE FROM tags WHERE id = ?').run(tag.id);
  req.session.flash = { type: 'success', key: 'flash.tag_deleted', params: { name: tag.name } };
  res.redirect('/admin/tags');
});

function consumeFlash(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f;
}

module.exports = router;
