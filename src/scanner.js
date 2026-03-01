/**
 * scanner.js — Recursively scans a directory for ebook files,
 * groups files with the same base name (differing only by extension)
 * into a single "book" entry.
 *
 * Persistence strategy
 * --------------------
 * The scan result is saved to a JSON cache file (CACHE_FILE env var,
 * default /data/library-cache.json).  On startup the cache is loaded
 * and an *incremental* check is performed:
 *
 *   1. Walk the filesystem collecting { path, mtime } for every
 *      supported file — this is fast (stat calls only, no I/O on file
 *      contents).
 *   2. Compare the resulting fingerprint against what is stored in the
 *      cache.
 *   3. If nothing changed, return the cached books immediately.
 *   4. If anything changed (new file, deleted file, modified mtime),
 *      regroup all files into books and save the new cache.
 *
 * This means a 500 GB library with no changes since the last run costs
 * only a directory walk on restart — no re-grouping, no re-hashing.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const SUPPORTED_EXTENSIONS = new Set([
  '.epub', '.pdf', '.mobi', '.azw', '.azw3',
  '.cbz', '.cbr', '.fb2', '.djvu', '.txt', '.lit',
]);

const CACHE_VERSION = 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(str) {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, 12);
}

// ── Filesystem walk ───────────────────────────────────────────────────────────

/**
 * Walk rootDir and collect every supported file as { path, ext, mtime }.
 * mtimes are stored as milliseconds-since-epoch for easy comparison.
 */
function walkFiles(rootDir) {
  const results = []; // { path, ext, mtimeMs }

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
        try {
          const { mtimeMs } = fs.statSync(fullPath);
          results.push({ path: fullPath, ext, mtimeMs });
        } catch {
          // file disappeared between readdir and stat — skip it
        }
      }
    }
  }

  walk(rootDir);
  return results;
}

// ── Grouping ──────────────────────────────────────────────────────────────────

/**
 * Group a flat list of { path, ext, mtimeMs } into Book objects.
 */
function groupFiles(rootDir, files) {
  const bookMap = new Map(); // "category::title" → book

  for (const f of files) {
    const dir      = path.dirname(f.path);
    const title    = path.basename(f.path, f.ext);
    const category = path.relative(rootDir, dir) || '/';
    const key      = `${category}::${title}`;

    let book = bookMap.get(key);
    if (!book) {
      book = { id: makeId(key), title, category, files: [], mtimeMs: 0 };
      bookMap.set(key, book);
    }

    book.files.push({ ext: f.ext, path: f.path, mtimeMs: f.mtimeMs });
    if (f.mtimeMs > book.mtimeMs) book.mtimeMs = f.mtimeMs;
  }

  const books = Array.from(bookMap.values());
  books.sort((a, b) =>
    a.category.localeCompare(b.category) || a.title.localeCompare(b.title)
  );
  return books;
}

// ── Cache I/O ─────────────────────────────────────────────────────────────────

function loadCache(cacheFile) {
  try {
    const raw   = fs.readFileSync(cacheFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.books)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(cacheFile, books) {
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    const tmp = cacheFile + '.tmp';
    fs.writeFileSync(
      tmp,
      JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), books }),
      'utf8'
    );
    fs.renameSync(tmp, cacheFile); // atomic on POSIX
  } catch (err) {
    console.warn(`[cache] Could not save cache to ${cacheFile}: ${err.message}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Perform an incremental scan of rootDir, using cacheFile to avoid
 * re-grouping when the library has not changed.
 *
 * Returns { books, fromCache } where fromCache indicates whether the
 * result came entirely from the saved cache (no filesystem changes).
 */
function scanLibrary(rootDir, cacheFile) {
  const cached = cacheFile ? loadCache(cacheFile) : null;

  // Build current filesystem fingerprint
  const fsFiles = walkFiles(rootDir);

  // Build fingerprint map from cache for O(1) lookup
  let cacheChanged = true;
  if (cached) {
    const cacheMap = new Map(); // path → mtimeMs
    for (const book of cached.books) {
      for (const f of book.files) {
        cacheMap.set(f.path, f.mtimeMs);
      }
    }

    // Same file count AND every file matches → cache is valid
    if (fsFiles.length === cacheMap.size) {
      cacheChanged = fsFiles.some(
        (f) => cacheMap.get(f.path) !== f.mtimeMs
      );
    }
  }

  if (!cacheChanged) {
    console.log(
      `[scan] ${cached.books.length} book(s) loaded from cache (no changes detected)`
    );
    return { books: cached.books, fromCache: true };
  }

  // Something changed — regroup and save
  const books = groupFiles(rootDir, fsFiles);
  console.log(`[scan] ${books.length} book(s) found (full regroup)`);

  if (cacheFile) {
    saveCache(cacheFile, books);
    console.log(`[scan] Cache saved to ${cacheFile}`);
  }

  return { books, fromCache: false };
}

/**
 * Return a flat sorted list of unique categories.
 */
function getCategories(books) {
  const cats = new Set(books.map((b) => b.category));
  return Array.from(cats).sort();
}

module.exports = { scanLibrary, getCategories, SUPPORTED_EXTENSIONS };
