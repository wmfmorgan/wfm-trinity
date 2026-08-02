# Manual multi-game acceptance checklist (Task 20)

**Date:** 2026-08-02  
**Branch:** `feature/infocom-workbench`  
**Automated baseline:** `npm test -- --run` → **175 passed** with `STORY_FILE=/tmp/minizork.z3`; **171 passed | 4 skipped** without story file. `npm run build` → **OK**.

Legend:

| Status | Meaning |
|--------|---------|
| **PASS (automated evidence)** | Covered by unit/integration tests or real-engine adapter tests |
| **PASS (manual verified)** | Verified without copyrighted Trinity (mock path, Mini-Zork headless, or static review) |
| **NEEDS_USER** | Requires user-owned Infocom story (e.g. Trinity) and/or visual browser check |

Story files are **never** committed. Use only files you legally own.

---

## Plan Task 20 checklist

### 1. Import game → appears in library

| Status | **PASS (automated evidence)** |
|--------|-------------------------------|
| Evidence | `libraryStore` → `importFiles hashes bytes, puts game, title from filename`; `importFiles accepts FileList-like multiple files` |
| Evidence | `LibraryScreen` → `imports files when user selects them`; `renders game card with New Game only when no autosave` |
| Evidence | `libraryRepo` → `stores and lists a game` |
| Remaining | **NEEDS_USER:** Import a real Infocom/Trinity `.z5` / `.zblorb` via UI file picker and confirm card title/metadata. |

### 2. New game → terminal output

| Status | **PASS (automated evidence)** |
|--------|-------------------------------|
| Evidence (mock) | `playStore` → `openGame new starts session at meadow with mock adapter` |
| Evidence (mock) | `gameSession` → `loads story, seeds map at first room, and starts transcript` |
| Evidence (mock) | `PlayWorkbench` → `open game + click north moves to woods (mock adapter)` |
| Evidence (real engine) | `zvmAdapter (real engine)` → `loads real story and produces transcript`; `submit look produces more transcript`; `createAdapter(zvm) returns real engine` — run with `STORY_FILE=/tmp/minizork.z3` |
| Remaining | **NEEDS_USER:** New game on owned Trinity (or other Infocom) in browser; confirm CRT transcript and status bar. |

### 3. Move via compass → map gains node; pan/zoom work

| Status | **PASS (automated evidence)** + **NEEDS_USER** for full visual |
|--------|----------------------------------------------------------------|
| Evidence (session/map) | `gameSession` → `submit north updates map and transcript`; `detects direction abbreviations via normalizeExitDir` |
| Evidence (map graph) | `mapGraph` → `places north room at dy -cellSize and adds edge`; `places east room at +cellSize x`; `does not create unvisited destination nodes from exits alone` |
| Evidence (compass UI) | `Compass` → `enables north when exit is in snapshot and submits on click` |
| Evidence (map UI) | `MapView` → `wheel zoom clamps between 0.4 and 2.5`; `recenter button centers camera`; `renders room name for a single node` |
| Evidence (workbench) | `PlayWorkbench` → `open game + click north moves to woods (mock adapter)` |
| Note | Real Z-machine adapters leave `exits: []` (SPIKE_NOTES); map grows from **successful movement**, not pre-known exits. Compass enables dirs when present in snapshot; typed `n`/`e`/… still work. |
| Remaining | **NEEDS_USER:** In browser with Mini-Zork or Trinity: move, confirm map node, drag-pan and wheel-zoom. |

### 4. Take object → inventory updates; click inserts; double-click examines

| Status | **PASS (automated evidence)** |
|--------|-------------------------------|
| Evidence (mock inv) | `mockAdapter` → `take lamp adds to inventory when in Woods` |
| Evidence (UI) | `InventoryPanel` → `calls onInsert when an item is clicked`; `calls onExamine on double-click without insert` |
| Evidence (workbench) | `PlayWorkbench` → `inventory insert queues pendingInsert into terminal draft` |
| Evidence (terminal) | `Terminal` → `applies insertText into the draft and calls onInsertApplied` |
| Remaining | **NEEDS_USER:** Real story (Mini-Zork/Trinity): `take …`, confirm inventory panel, click/double-click behavior. |

### 5. Autosave → reload page → Continue restores

| Status | **PASS (automated evidence)** + **NEEDS_USER** for full page reload |
|--------|---------------------------------------------------------------------|
| Evidence | `playStore` → `submit updates session and writes autosave`; `openGame continue restores from latest autosave` |
| Evidence | `saveService` → `autosave writes slotId autosave and name Autosave`; `autosave roundtrip restores location, map, and history`; `overwrites autosave on subsequent calls` |
| Evidence | `PlayWorkbench` → `pagehide triggers best-effort flushAutosave` |
| Evidence | `LibraryScreen` → `shows Continue when autosave exists`; `Continue calls openGame with continue mode` |
| Evidence (real engine) | `zvmAdapter` → `save/restore roundtrips location after movement` with Mini-Zork |
| Remaining | **NEEDS_USER:** Play, hard-reload browser tab, Continue — confirm transcript/map/location on owned story. |

### 6. Manual save slot load works

| Status | **PASS (automated evidence)** |
|--------|-------------------------------|
| Evidence | `playStore` → `saveToSlot writes manual named slot`; `openGame with slotId loads that slot` |
| Evidence | `saveService` → `saveSlot writes custom slot id and name` |
| Evidence | `SaveModal` → `Load calls onLoad with slotId`; `Save new calls onSaveNew with name when canSave`; `Overwrite confirms then calls onOverwrite` |
| Evidence | `PlayWorkbench` → `Saves button opens SaveModal` |
| Remaining | **NEEDS_USER:** Named slot save/load in browser on a real story. |

### 7. Feelie attach + view

| Status | **PASS (automated evidence)** |
|--------|-------------------------------|
| Evidence | `FeeliesStrip` → `adds a feelie via file input and lists it`; `click opens viewer for text feelie`; `click opens image viewer`; `click opens pdf viewer`; `allowDelete removes a feelie` |
| Evidence | `LibraryScreen` → `shows feelies management strip on each card` |
| Remaining | **NEEDS_USER:** Attach a real feelie PDF/image in browser; open viewer. |

### 8. Cover upload

| Status | **PASS (automated evidence)** |
|--------|-------------------------------|
| Evidence | `LibraryScreen` → `uploads cover image via card control`; `shows CoverPlaceholder monogram when no cover` |
| Evidence | `libraryStore` → `setCover stores cover and sets hasCover` |
| Evidence | `libraryRepo` → `stores and retrieves cover images` |
| Remaining | **NEEDS_USER:** Upload cover on a library card; confirm image persists after refresh. |

### 9. Second different game → isolated saves/map

| Status | **PASS (automated evidence)** + **NEEDS_USER** for two real stories |
|--------|---------------------------------------------------------------------|
| Evidence | `saveRepo` → `puts, gets, and lists saves per game` (keyed by `gameId`) |
| Evidence | `libraryRepo` → `deleteGameCascade removes story, cover, saves, map, and feelies` |
| Evidence | `libraryStore` → multi-file import; `hashStoryBytes` deterministic per content (`gameId.test`) |
| Evidence | Map graphs and save slots are stored with `gameId` — sessions do not share autosave/map rows |
| Remaining | **NEEDS_USER:** Import two owned stories (e.g. Mini-Zork + Trinity), play each, confirm saves/maps do not cross-contaminate. |

### 10. Narrow viewport tabs work

| Status | **PASS (automated evidence)** |
|--------|-------------------------------|
| Evidence | `PlayWorkbench responsive tabs` → `wide layout: no tab strip; all panes present` |
| Evidence | `medium (≤1100): Play\|Map tabs; map hidden until Map selected` |
| Evidence | `narrow (≤720): Play\|Map\|Inv\|More tabs switch panes` |
| Remaining | **NEEDS_USER:** Resize browser / DevTools device mode to ≤720px and click through tabs. |

---

## V1 success criteria (design spec)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Import supported Z-machine story and play intact in CRT terminal | **PASS (automated)** + **NEEDS_USER** | Mini-Zork headless via zvm; mock full shell. Browser CRT + Trinity: user. |
| Map builds as rooms visited; mouse pan and zoom | **PASS (automated)** + **NEEDS_USER** | Graph + MapView wheel/recenter tested; drag-pan visual: user. |
| Inventory and compass clickable; status bar shows available fields | **PASS (automated)** | InventoryPanel, Compass, status merge/filter tests. |
| Autosave and per-game manual slots; Continue restores play + map | **PASS (automated)** + **NEEDS_USER** | Full hard-reload: user. |
| Library covers/metadata and feelies | **PASS (automated)** | See items 7–8. |
| Responsive workbench on narrower widths | **PASS (automated)** + **NEEDS_USER** | Tab logic tested; visual polish: user. |
| Command history and autocomplete | **PASS (automated)** | `Terminal` history/Tab tests; `commandAssist` unit suite. |
| App runs locally on macOS via Vite with no required network | **PASS (manual verified)** | `npm run build` succeeds; README documents `npm run dev`; no network required after `npm install`. |

---

## How to complete remaining **NEEDS_USER** checks

### A. Headless real engine (no UI) — optional re-verify

```bash
# IF Archive Mini-Zork (demo; local only — do not commit)
curl -fsSL -o /tmp/minizork.z3 \
  https://www.ifarchive.org/if-archive/infocom/demos/minizork.z3

STORY_FILE=/tmp/minizork.z3 npm test -- --run
# Expect: 175 passed (includes zvmAdapter real-story tests)
```

### B. Browser multi-game pass (owned stories only)

1. `npm run dev` → open the Vite URL.
2. **Import** Mini-Zork (or any owned `.z3`–`.z8` / blorb raw ZCOD) and a second game (e.g. **Trinity** if you own it).
3. **New game** on game A → type `look` / move → confirm transcript + map nodes.
4. **Take** an object → inventory panel; click inserts name; double-click examines.
5. Play a few turns → **hard reload** → **Continue** restores location/map.
6. **Saves** → create named slot → load it.
7. Attach a **feelie** (image/PDF) and open viewer; upload a **cover**.
8. Switch to game B → play → confirm game A autosave/map unchanged.
9. Resize to ~700px width → use **Play / Map / Inv / More** tabs.
10. Optional CRT check: green phosphor, scanline/glow CSS present (Task 18).

### C. What this agent cannot do

- Cannot ship or open copyrighted Trinity binaries.
- Cannot drive a real browser viewport for pixel-level CRT/pan feel (jsdom covers structure/tabs only).

---

## Automated run log (Task 20)

| Command | Result |
|---------|--------|
| `npm test -- --run` | 24 files; **171 passed**, **4 skipped** (zvm real-story gated) |
| `STORY_FILE=/tmp/minizork.z3 npm test -- --run` | 24 files; **175 passed** |
| `npm run build` | **OK** (`tsc -b && vite build`) |

**P0 bugs found in automated path:** none.

---

## Known gaps (non-P0; from SPIKE_NOTES)

1. Adapter saves are custom `IWZ1` blobs, not Quetzal — portable only within this workbench.
2. Blorb (`.zblorb`) not unwrapped — import raw ZCOD or unwrapped story bytes.
3. Compass exits not extracted from object tree; map learns from movement.
4. In-game SAVE/RESTORE opcodes not wired to file picker.
