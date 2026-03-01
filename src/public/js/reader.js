/* reader.js — In-browser ebook reader */

const params    = new URLSearchParams(location.search);
const bookId    = params.get('id');
const ext       = params.get('ext'); // without leading dot
const container = document.getElementById('readerContainer');

document.getElementById('readerTitle').textContent = 'Loading…';

if (!bookId || !ext) {
  showError('Missing book parameters.');
} else {
  loadBook(bookId, ext);
}

async function loadBook(id, format) {
  // Fetch book metadata to get the title
  try {
    const res  = await fetch(`/api/books?q=`);
    const all  = await res.json();
    const book = all.find((b) => b.id === id);
    if (book) {
      document.title = book.title + ' — Book Library';
      document.getElementById('readerTitle').textContent = book.title;

      // Set download link
      const dl = document.getElementById('downloadLink');
      dl.href = `/download/${id}/${encodeURIComponent(book.title + '.' + format)}`;
    } else {
      document.getElementById('readerTitle').textContent = 'Book';
    }
  } catch { /* non-fatal */ }

  const src = `/read/${id}/${encodeURIComponent(format)}`;

  switch (format.toLowerCase()) {
    case 'epub': loadEpub(src); break;
    case 'pdf':  loadPdf(src);  break;
    case 'txt':
    case 'fb2':  loadText(src, format); break;
    default:     loadUnsupported(format, id); break;
  }
}

// ── EPUB via epub.js ──────────────────────────────────────────────────────────

function loadEpub(src) {
  const viewer = document.createElement('div');
  viewer.id = 'epub-viewer';
  container.appendChild(viewer);

  const book       = ePub(src);
  const rendition  = book.renderTo('epub-viewer', {
    width:  '100%',
    height: '100%',
    spread: 'none',
  });

  rendition.display();

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  prevBtn.hidden = false;
  nextBtn.hidden = false;

  prevBtn.addEventListener('click', () => rendition.prev());
  nextBtn.addEventListener('click', () => rendition.next());

  // Keyboard navigation
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rendition.next();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   rendition.prev();
  });

  rendition.on('rendered', () => {
    rendition.views().forEach((view) => {
      view.document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rendition.next();
        if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   rendition.prev();
      });
    });
  });
}

// ── PDF via iframe → browser PDF viewer ───────────────────────────────────────

function loadPdf(src) {
  const iframe = document.createElement('iframe');
  iframe.id    = 'reader-iframe';
  iframe.src   = src;
  iframe.title = 'PDF Viewer';
  container.appendChild(iframe);
}

// ── Plain text / FB2 ──────────────────────────────────────────────────────────

async function loadText(src, format) {
  const wrapper = document.createElement('div');
  wrapper.id = 'text-viewer';
  container.appendChild(wrapper);

  try {
    const res  = await fetch(src);
    const text = await res.text();

    if (format === 'fb2') {
      // Render FB2 as plain text (strip XML tags)
      const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n');
      const pre = document.createElement('pre');
      pre.textContent = stripped;
      wrapper.appendChild(pre);
    } else {
      const pre = document.createElement('pre');
      pre.textContent = text;
      wrapper.appendChild(pre);
    }
  } catch (err) {
    showError('Could not load file: ' + err.message);
  }
}

// ── Unsupported format ────────────────────────────────────────────────────────

function loadUnsupported(format, id) {
  container.innerHTML = `
    <div class="unsupported-msg">
      <span>In-browser reading is not supported for <strong>.${escHtml(format)}</strong> files.</span>
      <a class="btn btn-accent" href="/download/${escHtml(id)}/${encodeURIComponent('book.' + format)}" download>
        ↓ Download file
      </a>
      <a href="/" class="btn btn-ghost">← Back to library</a>
    </div>`;
}

function showError(msg) {
  container.innerHTML = `<div class="unsupported-msg"><span>${escHtml(msg)}</span><a href="/" class="btn btn-ghost">← Back</a></div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
