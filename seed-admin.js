#!/usr/bin/env node
// One-time script to create the first admin account.
// Usage: node seed-admin.js <username> <password>
const bcrypt = require('bcryptjs');
const db = require('./db/database');

const [,, username, password] = process.argv;
if (!username || !password) {
  console.error('Usage: node seed-admin.js <username> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existing) {
  console.error(`User "${username}" already exists`);
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
const now = Math.floor(Date.now() / 1000);
const result = db.prepare('INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, 1, ?)')
  .run(username, hash, now);

console.log(`Admin user "${username}" created (id=${result.lastInsertRowid})`);
console.log('You can now log in and generate invite links at /admin/invite');
