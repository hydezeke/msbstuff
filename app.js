const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db/database');
const SqliteStore = require('express-session-better-sqlite3')(session, db);
const config = require('./config');
const { injectCsrf } = require('./middleware/csrf');
const { loadCurrentUser } = require('./middleware/auth');

const app = express();

app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new SqliteStore(),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(injectCsrf);
app.use(loadCurrentUser);

app.use(require('./routes/auth'));
app.use(require('./routes/invite'));
app.use(require('./routes/listings'));
app.use(require('./routes/contact'));
app.use(require('./routes/dashboard'));
app.use(require('./routes/admin'));

app.use((req, res) => {
  res.status(404).send(require('./views/layout').layout('Not Found', `
    <div class="card" style="max-width:400px;margin:2rem auto;text-align:center">
      <h1>Page not found</h1>
      <p><a href="/">Go home</a></p>
    </div>
  `, { currentUser: res.locals.currentUser }));
});

module.exports = app;
