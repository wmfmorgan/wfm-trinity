# Infocom Workbench

Local-only web shell for playing Infocom-style Z-machine story files with CRT aesthetics, maps, notes, and feelies.

## Requirements

- Node.js 20+ recommended
- **You supply your own story files.** This repo does not include copyrighted games.

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

## Story files

Supported extensions (gitignored — never commit them):

- `.z3`–`.z8`
- `.zblorb` / `.blorb`
- `.zmachine`

Place or open story files from your machine only. Do not commit copyrighted Infocom (or other commercial) game files to this repository.

## Notes

- Runs entirely in the browser (local-only web app).
- No server-side game hosting.
