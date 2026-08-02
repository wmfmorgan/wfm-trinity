# Infocom Workbench

Local-only web shell for playing Infocom-style Z-machine story files with CRT aesthetics, maps, notes, and feelies.

## Legal / story ownership

**You must supply your own story files.** This repository does **not** include copyrighted Infocom (or other commercial) games.

- Only import files you legally own or are licensed to use (purchased, abandonware where lawfully obtained, or your own Inform/Z-code builds).
- Do not commit `.z3`–`.z8`, `.zblorb`, or `.blorb` story files to this repo.
- The app never hosts or downloads games for you — import is local file picker only.

## Requirements

- Node.js 20+ recommended
- A modern desktop browser (Chrome / Safari / Firefox) with IndexedDB

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run unit tests (Vitest) |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |

## How to import a story (e.g. Trinity)

1. Obtain a legal Z-machine story file (example filenames: `trinity.z5`, `trinity.zblorb`).
2. Open the app → **Library**.
3. Click **Import** and choose one or more story files.
4. The game appears as a card (title derived from the filename; you can rename it).
5. **New game** starts a fresh session; **Continue** restores the latest autosave when present.
6. Optional: upload a cover image on the card; attach feelies (maps, manuals, images, PDFs) on the play screen.

Supported extensions (gitignored — never commit them):

- `.z3`–`.z8`
- `.zblorb` / `.blorb`
- `.zmachine`

Empty or unreadable files surface an error banner and are not added to the library.

## Controls cheatsheet

| Control | Action |
| --- | --- |
| Command line | Type parser commands; **Enter** submits |
| ↑ / ↓ in input | Command history |
| Tab (in input) | Autocomplete from history / common verbs |
| Compass | Click a lit exit to move (`n`/`s`/`e`/`w`/… commands) |
| Inventory click | Insert object name into the command line |
| Inventory double-click | `examine <object>` |
| Map | Drag to pan; scroll / pinch to zoom; click a room to select |
| Saves | Open **Saves** for named slots; autosave runs after turns |
| Library | Return to the shelf; session is cleared (use Continue later) |
| Narrow viewport | Tabs: Play · Map · Inv · More |

## Data storage (IndexedDB)

All library data lives **in this browser’s IndexedDB** for this origin:

- Story file bytes
- Metadata, covers, feelies
- Autosaves and manual save slots
- Map graph / visit history

Nothing is uploaded to a server. Data is **per-origin and per-profile**.

### Clearing site data wipes the library

Using the browser’s **Clear site data** / **Clear browsing data** (or wiping IndexedDB / storage for this origin) **permanently deletes** your imported games, saves, maps, covers, and feelies. Export or re-import story files from disk if you need a backup — the workbench does not ship an export pack yet.

## Notes

- Runs entirely in the browser (local-only web app).
- No server-side game hosting.
- Interpreter and import failures show a dismissible error banner; during play you can also **Return to library**.
