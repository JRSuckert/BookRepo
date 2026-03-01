# CLAUDE.md — AI Assistant Guide for BookRepo

This file provides context and conventions for AI assistants (Claude Code and
similar tools) working in this repository.

---

## Repository Overview

**BookRepo** is a self-hosted, Dockerized ebook library manager built with
Node.js + Express. The application scans a mounted folder for ebooks, groups
files with the same title but different extensions into a single entry, and
exposes a web UI plus an OPDS 1.2 catalog feed.

```
BookRepo/
├── Dockerfile
├── docker-compose.yml
├── README.md
├── CLAUDE.md
└── src/
    ├── server.js        # Express entry point, API routes, file streaming
    ├── scanner.js       # Recursive ebook scanner & grouping logic
    ├── opds.js          # OPDS 1.2 Atom feed generator
    ├── package.json     # Node.js dependencies
    └── public/
        ├── index.html   # Library UI (book grid, sidebar, search)
        ├── reader.html  # In-browser reader (epub.js / PDF / plain-text)
        ├── css/
        │   ├── style.css
        │   └── reader.css
        └── js/
            ├── app.js   # Library UI logic
            └── reader.js
```

---

## Git Workflow

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable, production-ready code |
| `master` | Historical default branch (treat as equivalent to `main`) |
| `claude/<description>-<id>` | AI-assistant feature branches |

### Branch naming for AI sessions

AI-generated branches follow the pattern:

```
claude/<short-description>-<session-id>
```

Always develop on the designated feature branch for the session and **never
push directly to `main` or `master`** without an explicit instruction to do so.

### Commit messages

Write concise imperative-mood subject lines (≤72 characters), e.g.:

```
Add chapter outline for Part 1
Fix broken link in bibliography
Update README with build instructions
```

Use the body (separated by a blank line) for additional context when needed.

### Push procedure

```bash
git push -u origin <branch-name>
```

If the push fails due to a network error, retry with exponential back-off
(2 s → 4 s → 8 s → 16 s, up to four retries). Do **not** retry on HTTP 403
errors — those indicate an authorization problem, not a transient failure.

---

## Development Workflow

The project uses Node.js + Express, containerized via Docker.

```bash
# Install dependencies (for local development)
cd src && npm install

# Run locally (requires BOOKS_DIR to point to a real folder)
BOOKS_DIR=./books node src/server.js

# Build and run with Docker Compose
docker compose up -d

# Rebuild after source changes
docker compose up -d --build
```

### Making changes

1. Check out (or create) the appropriate feature branch.
2. Make focused, incremental changes.
3. Verify the build and tests pass before committing.
4. Write a clear commit message.
5. Push to the remote feature branch.

---

## Conventions for AI Assistants

### General principles

- **Read before editing.** Always read a file with the `Read` tool before
  modifying it, so changes are grounded in the actual content.
- **Minimal changes.** Only change what is directly requested or clearly
  necessary. Avoid opportunistic refactors, added comments, or extra features.
- **No invented structure.** Do not create directories, config files, or
  scaffolding that the user has not asked for.
- **Security first.** Avoid introducing command injection, XSS, SQL injection,
  or other OWASP Top 10 vulnerabilities.

### File editing

- Prefer the `Edit` tool for modifications (sends only the diff).
- Use `Write` only for new files or complete rewrites.
- Do not create documentation files (`.md`, `README`, etc.) unless explicitly
  requested — except for updates to this `CLAUDE.md`.

### Search and exploration

- Use `Glob` to find files by name pattern.
- Use `Grep` to search file contents.
- Use the `Explore` sub-agent for broad, multi-step codebase research.

### Committing

Only commit when the user explicitly asks. Stage specific files by name rather
than `git add -A` to avoid accidentally including secrets or generated files.

Pass commit messages via heredoc to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
Short imperative subject line

Optional body with more context.
EOF
)"
```

### Risky operations

Pause and confirm with the user before:

- Deleting files or branches
- Force-pushing
- Resetting or rebasing published commits
- Modifying CI/CD pipelines
- Pushing to `main` / `master`

---

## Current State Checklist

Track this as the project evolves. Check off items as they are implemented.

- [x] Repository initialized
- [x] `README.md` created
- [x] `CLAUDE.md` created
- [x] Language / framework chosen (Node.js + Express)
- [x] Dependencies / package manager configured (`npm`, `src/package.json`)
- [x] Source directory structure established (`src/`)
- [x] Docker + docker-compose configured
- [x] `README.md` updated with build and usage instructions
- [ ] Linter / formatter configured
- [ ] Test framework configured
- [ ] CI/CD pipeline configured

---

## Updating This File

When significant changes are made to the project — new tooling, new
conventions, new directory structure — update this `CLAUDE.md` to reflect the
current state. Keep it accurate and concise; it is the first thing an AI
assistant reads when starting a new session.
