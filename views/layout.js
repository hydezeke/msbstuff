function layout(title, content, opts = {}) {
  const { currentUser, flash } = opts;
  const nav = `
    <nav>
      <a href="/" class="nav-brand">msb's stuff sharer</a>
      <div class="nav-links">
        <a href="/">Listings</a>
        ${currentUser
          ? `<a href="/dashboard">My Items</a>
             ${currentUser.is_admin ? '<a href="/admin">Admin</a>' : ''}
             <form method="POST" action="/logout" style="display:inline">
               <input type="hidden" name="_csrf" value="${opts.csrfToken || ''}">
               <button type="submit" class="btn-link">Logout (${esc(currentUser.username)})</button>
             </form>`
          : `<a href="/login">Login</a>`}
      </div>
    </nav>`;

  const flashHtml = flash
    ? `<div class="flash flash-${flash.type}">${esc(flash.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
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
