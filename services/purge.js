const db = require('../db/database');

const SEVEN_DAYS = 7 * 24 * 60 * 60;

function purgeOldContactRequests() {
  const cutoff = Math.floor(Date.now() / 1000) - SEVEN_DAYS;
  const result = db.prepare('DELETE FROM contact_requests WHERE created_at < ?').run(cutoff);
  if (result.changes > 0) {
    console.log(`[purge] Deleted ${result.changes} old contact request(s)`);
  }
}

function startPurgeSchedule() {
  purgeOldContactRequests();
  setInterval(purgeOldContactRequests, 60 * 60 * 1000); // hourly
}

module.exports = { startPurgeSchedule };
