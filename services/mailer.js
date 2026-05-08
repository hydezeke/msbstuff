const nodemailer = require('nodemailer');
const config = require('../config');

let transport = null;

if (config.smtp.host && config.smtp.user) {
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

async function sendMail({ to, subject, text }) {
  if (!to) return;
  if (transport) {
    await transport.sendMail({ from: config.smtp.from, to, subject, text });
  } else {
    console.log(`[MAIL] To: ${to} | Subject: ${subject}\n${text}\n---`);
  }
}

module.exports = { sendMail };
