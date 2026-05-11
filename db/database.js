const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed a system user (id=0 not possible; use a placeholder admin insert approach)
// Default tags are seeded once on first boot via a sentinel check
const tagCount = db.prepare('SELECT COUNT(*) as n FROM tags').get().n;
if (tagCount === 0) {
  // Use a temporary admin placeholder — real admin created via seed-admin.js
  // We insert a system user only if no users exist yet, then remove after seeding
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (userCount === 0) {
    // Can't seed tags without a user FK — tags will be seeded when first admin is created
    // seed-admin.js handles this
  }
}

module.exports = db;
