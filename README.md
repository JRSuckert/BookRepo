# BookManager

A self-hosted, Dockerized ebook library manager.

## Features

- **Library view** — browse all ebooks in a mounted folder, organized by subfolder
- **Format grouping** — files with the same name but different extensions (e.g. `Book.epub` + `Book.pdf`) appear as a single card with multiple download/read buttons
- **In-browser reading** — EPUBs via epub.js, PDFs via the browser's native viewer, plain text and FB2 inline
- **OPDS 1.2 feed** — compatible with any OPDS-capable reader app (e.g. Kybook, Moon+ Reader, KOReader)
- **Category navigation** — sidebar built from your folder structure
- **Search** — instant filter by title
- **Auto-rescan** — library refreshed on a configurable interval; manual rescan button in the UI

## Supported formats

`epub` · `pdf` · `mobi` · `azw` / `azw3` · `cbz` · `cbr` · `fb2` · `djvu` · `txt` · `lit`

## Quick start

```bash
# 1. Clone the repo
git clone <repo-url>
cd BookRepo

# 2. Put your ebooks in ./books  (or edit docker-compose.yml to point elsewhere)
mkdir books
cp ~/my-ebooks/* books/

# 3. Build and run
docker compose up -d
```

Open **http://localhost:3000** in your browser.

OPDS feed: **http://localhost:3000/opds**

## Configuration

All settings are environment variables (set in `docker-compose.yml`):

| Variable     | Default    | Description                                      |
|--------------|------------|--------------------------------------------------|
| `BOOKS_DIR`  | `/books`   | Path to the mounted ebook folder inside container |
| `PORT`       | `3000`     | HTTP port the server listens on                  |
| `RESCAN_SEC` | `300`      | Seconds between automatic library rescans        |
| `BASE_URL`   | _(empty)_  | Public base URL when behind a reverse proxy      |

## Project structure

```
BookRepo/
├── Dockerfile
├── docker-compose.yml
├── README.md
├── CLAUDE.md
└── src/
    ├── server.js        # Express entry point + API routes
    ├── scanner.js       # Recursive file scanner & book grouper
    ├── opds.js          # OPDS 1.2 Atom feed generator
    ├── package.json
    └── public/
        ├── index.html   # Library UI
        ├── reader.html  # In-browser reader
        ├── css/
        │   ├── style.css
        │   └── reader.css
        └── js/
            ├── app.js
            └── reader.js
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/books` | List books (`?category=`, `?q=` filters) |
| GET | `/api/categories` | List all categories |
| POST | `/api/rescan` | Trigger library rescan |
| GET | `/download/:id/:filename` | Download a specific file |
| GET | `/read/:id/:ext` | Stream a file for in-browser reading |
| GET | `/opds` | OPDS root navigation feed |
| GET | `/opds/catalog` | OPDS all-books acquisition feed |
| GET | `/opds/category/:cat` | OPDS per-category acquisition feed |
