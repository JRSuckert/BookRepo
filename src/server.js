/**
 * server.js — Express server for the ebook library manager.
 *
 * Environment variables:
 *   BOOKS_DIR   — absolute path to mounted book folder (default: /books)
 *   PORT        — listening port (default: 3000)
 *   BASE_URL    — public base URL, no trailing slash (default: '')
 *   RESCAN_SEC  — how often (seconds) to rescan the library (default: 300)
 */

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const mime    = require('mime-types');

const { scanLibrary, getCategories } = require('./scanner');
const { registerOpds }               = require('./opds');

const BOOKS_DIR  = process.env.BOOKS_DIR  || '/books';
const PORT       = parseInt(process.env.PORT || '3000', 10);
const RESCAN_SEC = parseInt(process.env.RESCAN_SEC || '300', 10);

// ── Library cache ─────────────────────────────────────────────────────────────

let library = [];
let bookIndex = new Map(); // id → book

function rescan() {
  library  = scanLibrary(BOOKS_DIR);
  bookIndex = new Map(library.map((b) => [b.id, b]));
  console.log(`[scan] ${library.length} book(s) found in ${BOOKS_DIR}`);
}

rescan();
setInterval(rescan, RESCAN_SEC * 1000);

function getBooks() { return library; }

// ── App setup ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// ── OPDS ──────────────────────────────────────────────────────────────────────

registerOpds(app, getBooks);

// ── API ───────────────────────────────────────────────────────────────────────

// List all books (optionally filtered by category)
app.get('/api/books', (req, res) => {
  const { category, q } = req.query;
  let books = library;

  if (category && category !== '__all__') {
    books = books.filter((b) => b.category === category);
  }

  if (q) {
    const lq = q.toLowerCase();
    books = books.filter((b) => b.title.toLowerCase().includes(lq));
  }

  res.json(
    books.map((b) => ({
      id:       b.id,
      title:    b.title,
      category: b.category,
      formats:  b.files.map((f) => f.ext),
      mtime:    b.mtime,
    }))
  );
});

// List categories
app.get('/api/categories', (req, res) => {
  res.json(getCategories(library));
});

// Trigger a manual rescan
app.post('/api/rescan', (req, res) => {
  rescan();
  res.json({ ok: true, count: library.length });
});

// Download a specific format of a book
app.get('/download/:id/:filename', (req, res) => {
  const book = bookIndex.get(req.params.id);
  if (!book) return res.status(404).send('Not found');

  const ext      = path.extname(req.params.filename).toLowerCase();
  const fileEntry = book.files.find((f) => f.ext === ext);
  if (!fileEntry) return res.status(404).send('Format not found');

  const filePath = fileEntry.path;
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing');

  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(book.title + ext)}"`
  );
  fs.createReadStream(filePath).pipe(res);
});

// Stream a file for in-browser reading (no forced download)
app.get('/read/:id/:ext', (req, res) => {
  const book = bookIndex.get(req.params.id);
  if (!book) return res.status(404).send('Not found');

  const ext       = ('.' + req.params.ext).toLowerCase();
  const fileEntry = book.files.find((f) => f.ext === ext);
  if (!fileEntry) return res.status(404).send('Format not found');

  const filePath = fileEntry.path;
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing');

  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  const stat     = fs.statSync(filePath);

  // Support range requests (needed for PDF.js)
  const range = req.headers.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunkSize,
      'Content-Type':   mimeType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    fs.createReadStream(filePath).pipe(res);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`BookManager running on http://0.0.0.0:${PORT}`);
  console.log(`  Books dir : ${BOOKS_DIR}`);
  console.log(`  OPDS feed : http://0.0.0.0:${PORT}/opds`);
  console.log(`  Rescan    : every ${RESCAN_SEC}s`);
});
