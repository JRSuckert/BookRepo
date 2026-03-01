/**
 * opds.js — Generates OPDS 1.2 Atom feeds.
 *
 * Endpoints exposed:
 *   GET /opds              — root navigation feed
 *   GET /opds/catalog      — all books (acquisition feed)
 *   GET /opds/category/:cat — books in a category
 */

const { getCategories } = require('./scanner');

const OPDS_MIME = 'application/atom+xml;profile=opds-catalog;kind=navigation';
const ACQ_MIME  = 'application/atom+xml;profile=opds-catalog;kind=acquisition';
const SELF_BASE = process.env.BASE_URL || '';

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updated(date) {
  return (date || new Date()).toISOString();
}

function mimeForExt(ext) {
  const map = {
    '.epub': 'application/epub+zip',
    '.pdf':  'application/pdf',
    '.mobi': 'application/x-mobipocket-ebook',
    '.azw':  'application/vnd.amazon.ebook',
    '.azw3': 'application/vnd.amazon.ebook',
    '.cbz':  'application/vnd.comicbook+zip',
    '.cbr':  'application/vnd.comicbook-rar',
    '.fb2':  'application/fb2',
    '.txt':  'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function acquisitionEntries(books) {
  return books
    .map((book) => {
      const links = book.files
        .map(
          (f) =>
            `<link rel="http://opds-spec.org/acquisition" type="${xmlEscape(mimeForExt(f.ext))}" href="${SELF_BASE}/download/${book.id}/${encodeURIComponent(book.title + f.ext)}"/>`
        )
        .join('\n      ');

      return `  <entry>
    <title>${xmlEscape(book.title)}</title>
    <id>urn:bookmanager:book:${book.id}</id>
    <updated>${updated(book.mtime)}</updated>
    <category term="${xmlEscape(book.category)}" label="${xmlEscape(book.category)}"/>
    ${links}
  </entry>`;
    })
    .join('\n');
}

function rootFeed(books) {
  const cats = getCategories(books);
  const catEntries = cats
    .map(
      (cat) => `  <entry>
    <title>${xmlEscape(cat === '/' ? 'Root' : cat)}</title>
    <id>urn:bookmanager:category:${Buffer.from(cat).toString('hex')}</id>
    <updated>${updated()}</updated>
    <link type="${ACQ_MIME}" rel="subsection" href="${SELF_BASE}/opds/category/${encodeURIComponent(cat)}"/>
  </entry>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:bookmanager:root</id>
  <title>Book Library</title>
  <updated>${updated()}</updated>
  <link rel="self" href="${SELF_BASE}/opds" type="${OPDS_MIME}"/>
  <link rel="start" href="${SELF_BASE}/opds" type="${OPDS_MIME}"/>
  <link rel="http://opds-spec.org/crawlable" href="${SELF_BASE}/opds/catalog" type="${ACQ_MIME}"/>
  <entry>
    <title>All Books</title>
    <id>urn:bookmanager:all</id>
    <updated>${updated()}</updated>
    <link type="${ACQ_MIME}" rel="subsection" href="${SELF_BASE}/opds/catalog"/>
  </entry>
${catEntries}
</feed>`;
}

function catalogFeed(books) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:bookmanager:catalog</id>
  <title>All Books</title>
  <updated>${updated()}</updated>
  <link rel="self" href="${SELF_BASE}/opds/catalog" type="${ACQ_MIME}"/>
  <link rel="start" href="${SELF_BASE}/opds" type="${OPDS_MIME}"/>
${acquisitionEntries(books)}
</feed>`;
}

function categoryFeed(category, books) {
  const filtered = books.filter((b) => b.category === category);
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:bookmanager:category:${Buffer.from(category).toString('hex')}</id>
  <title>${xmlEscape(category === '/' ? 'Root' : category)}</title>
  <updated>${updated()}</updated>
  <link rel="self" href="${SELF_BASE}/opds/category/${encodeURIComponent(category)}" type="${ACQ_MIME}"/>
  <link rel="start" href="${SELF_BASE}/opds" type="${OPDS_MIME}"/>
${acquisitionEntries(filtered)}
</feed>`;
}

function registerOpds(app, getBooks) {
  app.get('/opds', (req, res) => {
    res.type('application/atom+xml').send(rootFeed(getBooks()));
  });

  app.get('/opds/catalog', (req, res) => {
    res.type('application/atom+xml').send(catalogFeed(getBooks()));
  });

  app.get('/opds/category/:cat', (req, res) => {
    const cat = decodeURIComponent(req.params.cat);
    res.type('application/atom+xml').send(categoryFeed(cat, getBooks()));
  });
}

module.exports = { registerOpds };
