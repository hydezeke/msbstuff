const express = require('express');
const db = require('../db/database');
const { layout, esc } = require('../views/layout');
const { t } = require('../i18n/strings');
const { requireAuth } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrf');
const { checkHoneypot } = require('../middleware/honeypot');
const { postLimiter } = require('../middleware/rateLimiter');
const { sendMail } = require('../services/mailer');

const router = express.Router();

router.get('/contact/:listingId', requireAuth, (req, res) => {
  const lang = res.locals.lang;
  const listing = db.prepare(`
    SELECT l.*, u.username FROM listings l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ? AND l.is_deleted = 0
  `).get(req.params.listingId);

  if (!listing) return res.status(404).redirect('/');
  if (listing.user_id === req.session.userId) return res.redirect(`/listings/${listing.id}`);

  const html = layout(`${t('contact.heading', lang)}: ${listing.title}`, `
    <div class="card" style="max-width:520px;margin:0 auto">
      <p style="margin-bottom:0.75rem"><a href="/listings/${listing.id}">${t('contact.back', lang)}</a></p>
      <h1 style="font-size:1.3rem">${t('contact.heading', lang)}: ${esc(listing.title)}</h1>
      <p style="margin:0.5rem 0 1rem;color:var(--text-muted);font-size:0.9rem">
        ${t('contact.privacy_note', lang, { user: listing.username })}
      </p>
      <form method="POST" action="/contact/${listing.id}">
        <input type="hidden" name="_csrf" value="${esc(res.locals.csrfToken)}">
        <div class="hp-field"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="field">
          <label for="requester_contact">${t('contact.label_contact', lang)}</label>
          <input type="text" id="requester_contact" name="requester_contact" required maxlength="200">
          <p class="hint">${t('contact.hint_contact', lang, { user: listing.username })}</p>
        </div>
        <div class="field">
          <label for="message">${t('contact.label_message', lang)}</label>
          <textarea id="message" name="message" maxlength="1000"
            placeholder="${t('contact.placeholder', lang)}"></textarea>
        </div>
        ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
        <div style="display:flex;gap:0.5rem">
          <button type="submit" class="btn btn-primary">${t('contact.submit', lang)}</button>
          <a href="/listings/${listing.id}" class="btn btn-secondary">${t('contact.cancel', lang)}</a>
        </div>
      </form>
    </div>
  `, { currentUser: res.locals.currentUser, csrfToken: res.locals.csrfToken, lang });
  res.send(html);
});

router.post('/contact/:listingId', requireAuth, postLimiter, validateCsrf, checkHoneypot, async (req, res) => {
  const lang = res.locals.lang;
  const listing = db.prepare(`
    SELECT l.*, u.username FROM listings l
    JOIN users u ON l.user_id = u.id
    WHERE l.id = ? AND l.is_deleted = 0
  `).get(req.params.listingId);

  if (!listing) return res.redirect('/');
  if (listing.user_id === req.session.userId) return res.redirect(`/listings/${listing.id}`);

  const { requester_contact, message } = req.body;
  if (!requester_contact || !requester_contact.trim()) {
    return res.redirect(`/contact/${listing.id}?error=${encodeURIComponent(t('contact.label_contact', lang) + ' required')}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const cr = db.prepare(`
    INSERT INTO contact_requests (listing_id, requester_contact, message, created_at)
    VALUES (?, ?, ?, ?)
  `).run(listing.id, requester_contact.trim(), (message || '').trim() || null, now);

  const requester = db.prepare('SELECT username FROM users WHERE id = ?').get(req.session.userId);

  await sendMail({
    to: listing.username,
    subject: `[msb's stuff sharer] Someone wants your item: ${listing.title}`,
    text: `Hi ${listing.username},\n\n${requester.username} is interested in: "${listing.title}"\n\nContact: ${requester_contact}\nMessage: ${message || '(none)'}\n\nThis contact info will be deleted in 7 days.`,
  });

  db.prepare('UPDATE contact_requests SET delivered = 1 WHERE id = ?').run(cr.lastInsertRowid);

  req.session.flash = { type: 'success', key: 'flash.message_sent' };
  res.redirect(`/listings/${listing.id}`);
});

module.exports = router;
