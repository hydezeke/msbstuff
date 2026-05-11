const config = require('../config');
const db = require('../db/database');

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

async function callLingva(source, target, text) {
  if (!config.lingvaUrl || !text || !text.trim()) return null;
  const url = `${config.lingvaUrl}/api/v1/${source}/${target}/${encodeURIComponent(text.trim())}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Lingva ${res.status}`);
  return res.json();
}

// Detect language and translate in one call. Returns { translation, detectedSource } or null on error.
async function detectAndTranslate(text, targetLang) {
  try {
    const data = await callLingva('auto', targetLang, text);
    if (!data) return null;
    return {
      translation: data.translation || null,
      detectedSource: data.info?.detectedSource || null,
    };
  } catch (e) {
    console.warn('[translator] detectAndTranslate failed:', e.message);
    return null;
  }
}

// Get or create cached translation for a listing. Returns { title, description } or null.
async function getListingTranslation(listing, targetLang) {
  if (!config.lingvaUrl) return null;

  // Skip if we already know the source matches the target
  if (listing.detected_lang && listing.detected_lang === targetLang) return null;

  const now = Math.floor(Date.now() / 1000);
  const cached = db.prepare(
    'SELECT * FROM listing_translations WHERE listing_id = ? AND lang = ?'
  ).get(listing.id, targetLang);

  if (cached && (now - cached.translated_at) < CACHE_TTL) {
    // Cached entry exists but source == target means no translation needed
    if (cached.title === null && cached.description === null) return null;
    return { title: cached.title, description: cached.description };
  }

  // Fetch translations in parallel
  const [titleResult, descResult] = await Promise.all([
    detectAndTranslate(listing.title, targetLang),
    listing.description
      ? detectAndTranslate(listing.description, targetLang)
      : Promise.resolve(null),
  ]);

  const detectedLang = titleResult?.detectedSource || null;

  // Persist the detected language back onto the listing if we learned it
  if (detectedLang && !listing.detected_lang) {
    db.prepare('UPDATE listings SET detected_lang = ? WHERE id = ?').run(detectedLang, listing.id);
  }

  // If source and target are the same, store a null-marker so we don't re-hit the API
  if (detectedLang && detectedLang === targetLang) {
    db.prepare(`
      INSERT INTO listing_translations (listing_id, lang, title, description, translated_at)
      VALUES (?, ?, NULL, NULL, ?)
      ON CONFLICT(listing_id, lang) DO UPDATE SET title=NULL, description=NULL, translated_at=?
    `).run(listing.id, targetLang, now, now);
    return null;
  }

  const translatedTitle = titleResult?.translation || null;
  const translatedDesc = descResult?.translation || null;

  db.prepare(`
    INSERT INTO listing_translations (listing_id, lang, title, description, translated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(listing_id, lang) DO UPDATE SET title=?, description=?, translated_at=?
  `).run(listing.id, targetLang, translatedTitle, translatedDesc, now,
         translatedTitle, translatedDesc, now);

  if (!translatedTitle && !translatedDesc) return null;
  return { title: translatedTitle, description: translatedDesc };
}

// Get or create cached translation for a tag name. Returns translated string or null.
async function getTagTranslation(tag, targetLang) {
  if (!config.lingvaUrl) return null;

  const now = Math.floor(Date.now() / 1000);
  const cached = db.prepare(
    'SELECT * FROM tag_translations WHERE tag_id = ? AND lang = ?'
  ).get(tag.id, targetLang);

  if (cached && (now - cached.translated_at) < CACHE_TTL) {
    return cached.name || null;
  }

  const result = await detectAndTranslate(tag.name, targetLang);
  if (!result?.translation) return null;

  // Don't store if source matches target
  if (result.detectedSource && result.detectedSource === targetLang) return null;

  db.prepare(`
    INSERT INTO tag_translations (tag_id, lang, name, translated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(tag_id, lang) DO UPDATE SET name=?, translated_at=?
  `).run(tag.id, targetLang, result.translation, now, result.translation, now);

  return result.translation;
}

// Translate all tags for a listing, returning an enriched tag array with .translatedName
async function translateTags(tags, targetLang) {
  if (!config.lingvaUrl || !tags.length) return tags;
  const translated = await Promise.all(
    tags.map(async tag => ({
      ...tag,
      translatedName: await getTagTranslation(tag, targetLang),
    }))
  );
  return translated;
}

module.exports = { detectAndTranslate, getListingTranslation, getTagTranslation, translateTags };
