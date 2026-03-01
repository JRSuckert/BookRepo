/* app.js — Library UI */

let allBooks = [];
let currentCategory = '__all__';

const bookGrid      = document.getElementById('bookGrid');
const categoryList  = document.getElementById('categoryList');
const searchInput   = document.getElementById('searchInput');
const emptyMsg      = document.getElementById('emptyMsg');
const rescanBtn     = document.getElementById('rescanBtn');

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchBooks(category, q) {
  const params = new URLSearchParams();
  if (category && category !== '__all__') params.set('category', category);
  if (q) params.set('q', q);
  const res = await fetch('/api/books?' + params);
  return res.json();
}

async function fetchCategories() {
  const res = await fetch('/api/categories');
  return res.json();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function iconForExt(ext) {
  const icons = {
    '.epub': '📖', '.pdf': '📄', '.mobi': '📱',
    '.azw': '📱', '.azw3': '📱', '.cbz': '🖼️',
    '.cbr': '🖼️', '.fb2': '📝', '.txt': '📃',
  };
  return icons[ext] || '📁';
}

function renderableExt(ext) {
  return ['.epub', '.pdf', '.txt', '.fb2'].includes(ext);
}

function bestReadableExt(formats) {
  const priority = ['.epub', '.pdf', '.txt', '.fb2'];
  for (const p of priority) {
    if (formats.includes(p)) return p;
  }
  return null;
}

function renderBook(book) {
  const card = document.createElement('div');
  card.className = 'book-card';

  const coverIcon = iconForExt(book.formats[0] || '');

  const readableExt = bestReadableExt(book.formats);
  const readBtn = readableExt
    ? `<a class="btn btn-accent" href="/reader.html?id=${book.id}&ext=${encodeURIComponent(readableExt.slice(1))}">Read</a>`
    : '';

  const downloadBtns = book.formats
    .map(
      (ext) =>
        `<a class="btn btn-ghost" href="/download/${book.id}/${encodeURIComponent(book.title + ext)}" download>↓ ${ext.slice(1).toUpperCase()}</a>`
    )
    .join('');

  const formatBadges = book.formats
    .map((ext) => `<span class="format-badge">${ext.slice(1)}</span>`)
    .join('');

  card.innerHTML = `
    <div class="book-cover">${coverIcon}</div>
    <div class="book-info">
      <div class="book-title">${escHtml(book.title)}</div>
      <div class="book-category">${escHtml(book.category === '/' ? '' : book.category)}</div>
      <div class="book-formats">${formatBadges}</div>
    </div>
    <div class="book-actions">
      ${readBtn}
      ${downloadBtns}
    </div>
  `;
  return card;
}

function renderBooks(books) {
  bookGrid.innerHTML = '';
  emptyMsg.hidden = books.length > 0;

  // Group by category when showing all
  if (currentCategory === '__all__') {
    const groups = new Map();
    for (const book of books) {
      if (!groups.has(book.category)) groups.set(book.category, []);
      groups.get(book.category).push(book);
    }
    for (const [cat, catBooks] of groups) {
      const heading = document.createElement('div');
      heading.className = 'category-heading';
      heading.textContent = cat === '/' ? 'Root' : cat;
      bookGrid.appendChild(heading);
      for (const book of catBooks) bookGrid.appendChild(renderBook(book));
    }
  } else {
    for (const book of books) bookGrid.appendChild(renderBook(book));
  }
}

function renderCategories(categories) {
  categoryList.innerHTML = '';

  const allLi = document.createElement('li');
  const allA  = document.createElement('a');
  allA.href  = '#';
  allA.textContent = 'All Books';
  if (currentCategory === '__all__') allA.classList.add('active');
  allA.addEventListener('click', (e) => { e.preventDefault(); selectCategory('__all__', allA); });
  allLi.appendChild(allA);
  categoryList.appendChild(allLi);

  for (const cat of categories) {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href  = '#';
    a.textContent = cat === '/' ? '/ (root)' : cat;
    a.title = cat;
    if (currentCategory === cat) a.classList.add('active');
    a.addEventListener('click', (e) => { e.preventDefault(); selectCategory(cat, a); });
    li.appendChild(a);
    categoryList.appendChild(li);
  }
}

// ── Interactions ──────────────────────────────────────────────────────────────

function selectCategory(cat, anchor) {
  currentCategory = cat;
  document.querySelectorAll('#categoryList a').forEach((a) => a.classList.remove('active'));
  if (anchor) anchor.classList.add('active');
  refresh();
}

let searchTimeout;
function refresh() {
  const q = searchInput.value.trim();
  fetchBooks(currentCategory, q).then(renderBooks);
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(refresh, 280);
});

rescanBtn.addEventListener('click', async () => {
  rescanBtn.disabled = true;
  rescanBtn.textContent = '⟳ Scanning…';
  await fetch('/api/rescan', { method: 'POST' });
  await init();
  rescanBtn.disabled = false;
  rescanBtn.textContent = '⟳ Rescan';
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function init() {
  const [books, categories] = await Promise.all([
    fetchBooks(currentCategory, ''),
    fetchCategories(),
  ]);
  allBooks = books;
  renderCategories(categories);
  renderBooks(books);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
