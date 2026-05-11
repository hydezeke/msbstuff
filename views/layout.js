const { t } = require('../i18n/strings');

function layout(title, content, opts = {}) {
  const { currentUser, flash, lang: rawLang, csrfToken } = opts;
  const lang = rawLang || 'en';

  const nav = `
    <nav>
      <a href="/" class="nav-brand"><img src="/logo.png" class="nav-logo" alt="">msb's stuff sharer</a>
      <form method="POST" action="/settings/language" class="lang-form">
        <input type="hidden" name="_csrf" value="${esc(csrfToken || '')}">
        <select name="lang" class="lang-select" onchange="this.form.submit()" title="Language / Idioma">
          <option value="en"${lang === 'en' ? ' selected' : ''}>EN</option>
          <option value="es"${lang === 'es' ? ' selected' : ''}>ES</option>
        </select>
      </form>
      <div class="nav-links">
        <a href="/">${t('nav.listings', lang)}</a>
        ${currentUser
          ? `<a href="/dashboard">${t('nav.my_items', lang)}</a>
             ${currentUser.is_admin ? `<a href="/admin">${t('nav.admin', lang)}</a>` : ''}
             <form method="POST" action="/logout" style="display:inline">
               <input type="hidden" name="_csrf" value="${esc(csrfToken || '')}">
               <button type="submit" class="btn-link">${t('nav.logout', lang)} (${esc(currentUser.username)})</button>
             </form>`
          : `<a href="/login">${t('nav.login', lang)}</a>`}
      </div>
    </nav>`;

  const flashHtml = flash ? renderFlash(flash, lang) : '';

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — msb's stuff sharer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <script src="https://unpkg.com/htmx.org@1.9.12" integrity="sha384-ujb1lZYygJmzgSwoxRggbCHcjc0rB2uodhuwjmnxp8QB1X8+I/9rvv9p5LRc2+I" crossorigin="anonymous"></script>
</head>
<body>
  ${nav}
  <main>
    ${flashHtml}
    ${content}
  </main>
</body>
</html>`;
}

function renderFlash(flash, lang) {
  let message;
  if (flash.key) {
    message = t(flash.key, lang, flash.params);
  } else {
    message = flash.message || '';
  }
  return `<div class="flash flash-${esc(flash.type)}">${esc(message)}</div>`;
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

module.exports = { layout, esc };
