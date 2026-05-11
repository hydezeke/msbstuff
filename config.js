require('dotenv').config();

const config = Object.freeze({
  port: parseInt(process.env.PORT || '3000', 10),
  sessionSecret: process.env.SESSION_SECRET || (() => { throw new Error('SESSION_SECRET is required'); })(),
  dbPath: process.env.DB_PATH || './data.db',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@example.com',
  },
  adminEmail: process.env.ADMIN_EMAIL || '',
  lingvaUrl: (process.env.LINGVA_URL || '').replace(/\/$/, ''),
  supportedLangs: ['en', 'es'],
  defaultLang: 'en',
});

module.exports = config;
