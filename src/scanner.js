/**
 * scanner.js — Recursively scans a directory for ebook files,
 * groups files with the same base name (differing only by extension)
 * into a single "book" entry.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_EXTENSIONS = new Set([
  '.epub', '.pdf', '.mobi', '.azw', '.azw3',
  '.cbz', '.cbr', '.fb2', '.djvu', '.txt', '.lit',
]);

/**
 * Returns a stable ID from a string (for use in URLs / OPDS).
 */
function makeId(str) {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, 12);
}

/**
 * Recursively scan `rootDir` and return an array of Book objects.
 *
 * Book = {
 *   id:        string,
 *   title:     string,          // base filename without extension
 *   category:  string,          // relative folder path from rootDir
 *   files:     [{ ext, path }], // one entry per supported file found
 *   mtime:     Date,            // most recent mtime across all files
 * }
 */
function scanLibrary(rootDir) {
  // Map from "category::title" → book
  const bookMap = new Map();

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

        const title = path.basename(entry.name, ext);
        const category = path.relative(rootDir, dir) || '/';
        const key = `${category}::${title}`;

        let book = bookMap.get(key);
        if (!book) {
          book = {
            id: makeId(key),
            title,
            category,
            files: [],
            mtime: new Date(0),
          };
          bookMap.set(key, book);
        }

        const stat = fs.statSync(fullPath);
        book.files.push({ ext, path: fullPath });
        if (stat.mtime > book.mtime) book.mtime = stat.mtime;
      }
    }
  }

  walk(rootDir);

  const books = Array.from(bookMap.values());
  books.sort((a, b) =>
    a.category.localeCompare(b.category) || a.title.localeCompare(b.title)
  );
  return books;
}

/**
 * Return a flat sorted list of unique categories.
 */
function getCategories(books) {
  const cats = new Set(books.map((b) => b.category));
  return Array.from(cats).sort();
}

module.exports = { scanLibrary, getCategories, SUPPORTED_EXTENSIONS };
