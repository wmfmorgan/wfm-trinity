# Infocom Workbench — Design Spec

**Date:** 2026-08-02  
**Project:** wfm-trinity  
**Status:** Approved for implementation planning  
**Approach:** Browser Z-machine + React shell (Approach 1)

## Summary

A local web app that runs **original Infocom (and other Z-machine) story files** unchanged, inside a modern UI that mimics a CRT terminal. The game logic is never rewritten. A live map builds as the player explores; inventory, compass/exits, and status are always visible. The shell supports a multi-game library with covers, metadata, feelies, autosave, and per-game save slots.

**Primary environment:** macOS, browser via Vite (`npm run dev` / localhost). No cloud backend required for play.

---

## Goals

1. Keep Infocom games **intact** (original story files via Z-machine).
2. Support **any** compatible Infocom/Z-machine game, not only Trinity.
3. CRT terminal aesthetic with a classic IF **workbench** layout.
4. Live **map** (visited rooms only), **inventory**, **compass/exits**, **status bar**.
5. Hybrid interaction: panels are **clickable**; map supports **mouse pan/zoom**.
6. **Autosave**, per-game saves, command history, autocomplete.
7. **Game library** with covers/metadata and a **feelies** panel.
8. **Responsive** layout; desktop-first.

## Non-goals (V1)

- Rewriting or porting game logic (e.g. from ZIL).
- Shipping copyrighted story files in the repository.
- Cloud sync, accounts, or a required network for play.
- Desktop packaging (Electron/Tauri) — web/local only.
- Features listed under [Backlog](#backlog).

---

## Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Runtime | Web app (Vite), run locally on macOS |
| Multi-game | Generic Z-machine loader from day one; Trinity is primary test title |
| Interaction | Hybrid: clickable map/inventory/compass/feelies |
| Map camera | Mouse pan + zoom; free scroll around the graph |
| Layout | Classic IF workbench (terminal center, rails for inv/compass/map) |
| Map movement | Compass/exits move the player; clicking a room **selects** only (no pathfind in V1) |
| Themes | One polished CRT theme in V1 |

---

## Architecture

### Runtime model

- **Host:** Browser on macOS via Vite dev server or local static preview.
- **No gameplay backend** — client-only.
- Story files, saves, covers, and feelies remain on the machine (browser storage).

### Layers

```
┌──────────────────────────────────────────────┐
│  UI (React)                                  │
│  Terminal · Map · Inventory · Compass ·      │
│  Status · Library · Feelies                  │
├──────────────────────────────────────────────┤
│  App services                                │
│  GameSession · MapGraph · SaveService ·      │
│  LibraryStore · CommandAssist                │
├──────────────────────────────────────────────┤
│  Z-machine adapter                           │
│  load story · turn input · read state        │
│  (location, inventory, exits, score, moves)  │
├──────────────────────────────────────────────┤
│  Persistence (IndexedDB)                     │
│  per-game saves · autosave · library meta    │
└──────────────────────────────────────────────┘
```

### Core modules

| Module | Responsibility |
|--------|----------------|
| **LibraryStore** | Import/list games; covers, metadata, feelies; story file blobs |
| **GameSession** | Boot story, send commands, receive output, expose turn snapshots |
| **ZMachineAdapter** | Wrap JS interpreter; normalize API for `.z3`–`.z8` / blorb when supported |
| **WorldView** | Derive room, inventory, exits, score/moves from each snapshot |
| **MapGraph** | Nodes = visited rooms; edges = observed exits; layout sticky; camera separate |
| **SaveService** | Autosave after turns; manual slots; keyed by `gameId` |
| **CommandAssist** | History (↑/↓); autocomplete from verbs + inventory + scoped objects |

### Invariants

1. **Story logic is never rewritten** — only interpreter + UI shell.
2. **UI actions that affect the world submit normal parser commands** (e.g. click North → `north`).
3. **Per-game isolation** — saves and map progress do not leak across titles.
4. **Local-only** — no required network for play.

### Game identity

Each library entry has a stable `gameId` derived primarily from a **hash of story file bytes**, with filename as display fallback. Renaming a file should not orphan saves if the bytes match.

---

## Game session, Z-machine & world state

### Boot sequence

1. User selects a game from the library (or imports a story file).
2. `GameSession` loads story bytes into the Z-machine adapter.
3. Interpreter runs until it waits for input (banner + first prompt).
4. Adapter emits a `TurnSnapshot`; UI renders transcript and panels.
5. If an autosave exists for this `gameId`, offer **Continue** vs **New game**.

### Turn loop

```
player input (typed or UI click)
  → GameSession.submit(command)
  → Z-machine executes until next read
  → TurnSnapshot
  → UI + MapGraph + SaveService update
```

### TurnSnapshot

Canonical shape after each turn. UI does not call the interpreter directly.

| Field | Meaning |
|-------|---------|
| `transcriptDelta` | New text since last prompt |
| `location` | `{ id, name }` — current room |
| `inventory` | `[{ id, name }, …]` — objects held by player |
| `exits` | `[{ dir, label?, toId? }, …]` — exits from current room |
| `status` | `{ score?, moves?, hours?, minutes?, other? }` — only fields the story exposes |
| `waitingFor` | `line` \| `char` \| `finished` |
| `raw` | Optional debug payload (development only) |

### Reading world state (generic Infocom)

Prefer **object tree / standard structures** over parsing English output:

| Need | Strategy |
|------|----------|
| Location | Player’s parent (room), or location global when available |
| Room name | Short name of location object |
| Inventory | Children of player object |
| Exits | Direction properties on room when readable; else edges from successful moves |
| Score / moves | Header/globals when present; omit unused fields from status bar |

Panels are a **best-effort world view**. The story file remains authoritative. Unusual games may show incomplete panels but remain fully playable via the terminal.

### UI actions → commands

| UI action | Behavior |
|-----------|----------|
| Compass / exit | Submit movement command (`north`, `up`, `in`, …) |
| Inventory single-click | Insert object name into command line at cursor |
| Inventory double-click | Submit `examine <name>` |
| Map room click | Select/highlight only; **no auto-walk in V1** |
| Map pan/zoom | Camera only; no game commands |

### Command assist

- **History:** session list; ↑/↓ through prior commands.
- **Autocomplete:** Tab cycles candidates from a fixed verb list + inventory names + in-scope objects when available; never auto-submits.

### Errors & edge cases

| Case | Behavior |
|------|----------|
| Unsupported / corrupt story | Clear library error; do not crash shell |
| Interpreter exception | Show error; keep last good snapshot; offer reload from autosave |
| Game over | Keep transcript; enable Restart from UI |
| `quit` | Confirm; return to library |

---

## Map model & interaction

### Purpose

Show where the player has been and where they are. Built only from play (no spoilers for unvisited geography). Mouse pan and zoom for large maps.

### Data model

```
MapGraph {
  gameId
  nodes: Map<roomId, RoomNode>
  edges: Edge[]
}

RoomNode {
  id, name
  firstVisitTurn, lastVisitTurn
  x, y          // sticky layout coordinates
}

Edge {
  fromId, toId
  dir           // "north" | "up" | "in" | ...
  bidirectional
}
```

### Growth rules (each turn)

1. Read `location` from `TurnSnapshot`.
2. If room is new → add node; place with layout rules.
3. If player moved from previous location with direction D → add edge.
4. For current room, show **exit stubs** for unknown destinations (direction known, room not visited).
5. **Visited-only nodes** — destination rooms appear only after the player goes there.

### Layout

| Concern | V1 approach |
|---------|-------------|
| Placement | Relative to previous room by move direction; fixed spacing |
| Collisions | Nudge to nearest free grid cell |
| Stability | Do not global-reflow after placement |
| User drag rooms | Out of scope (backlog) |
| Camera | Pan (drag), zoom (wheel/pinch), clamped; optional recenter-on-player control |

### Visual language

- CRT-consistent palette (dim chrome, phosphor accents).
- Current room: distinct fill + soft pulse (disabled under `prefers-reduced-motion`).
- Visited rooms: outlined nodes with truncated labels.
- Edges: simple lines; direction labels on hover if cluttered.
- Unknown stubs: dim dashed ticks.
- Empty state: “Explore to chart the map.”

### Persistence

- Map graph stored per `gameId` with saves so Continue restores chart progress.
- **New Game** clears map for that run.
- Removing a library entry wipes its map and saves.

### Map edge cases

| Case | Behavior |
|------|----------|
| Dark / nameless rooms | Fallback label + id |
| Teleports / non-dir moves | Edge without dir or labeled `?` |
| Huge maps | Zoom out hides labels; pan freely |

---

## Library, covers/metadata, feelies & saves

### Game library

| Action | Behavior |
|--------|----------|
| Import | File picker: `.z3`–`.z8`, `.zblorb`/`.blorb` when supported |
| List | Cards with cover or placeholder, title, author if known, last played |
| Open | Continue (if save) vs New Game |
| Remove | Confirm → delete story blob + saves + map + feelies for `gameId` |

**Legal:** Repository does not ship copyrighted story files. Users supply legally obtained files. Documented in README.

**Storage:** IndexedDB for blobs and metadata.

### Covers & metadata

| Field | V1 |
|-------|-----|
| Title, author, year, IFID (if known), series, notes | User-editable |
| Cover image | User upload or monogram placeholder |
| Auto-detect | Best-effort from blorb/local hints only; **no required network** |

### Feelies panel

Per-game attachments (maps, docs, images the user owns):

- Attach: pdf, png, jpg, txt, markdown.
- View: in-app for images/text; PDF via browser/object URL.
- Flat list with optional labels; bound to `gameId`.
- Reference only — not injected into the Z-machine.

### Saves

All slots namespaced by `gameId`.

| Type | Behavior |
|------|----------|
| Autosave | After every successful turn; also best-effort on page hide/unload; rotating autosave (single, or last 3 if cheap) |
| Manual slots | Named slots from UI |
| Continue | Loads latest autosave; full slot picker available |
| New Game | Fresh interpreter; clear run map; confirm if autosave exists |

**Save payload:** Prefer real Z-machine save/restore from the interpreter, plus shell state (map graph, timestamps, optional transcript tail).  
**Implementation risk:** Interpreter save/restore must be **spiked early**. Re-play-transcript-only is a last resort, not the design target.

---

## UI shell (CRT, layout, responsive) & input

### Screens

1. **Library** — shelf, import, metadata, feelies management.
2. **Play workbench** — main game UI.
3. **Modals** — save slots, feelie viewer, confirmations, minimal settings.

### Workbench layout (desktop)

```
┌────────────────────────────────────────────────────────────┐
│ [Library]  TITLE                    score · moves · time   │
├────────────┬─────────────────────────────┬─────────────────┤
│ INVENTORY  │                             │                 │
│            │     CRT TERMINAL            │  MAP            │
│ COMPASS    │     transcript + prompt     │  pan / zoom     │
│            │                             │                 │
├────────────┴─────────────────────────────┴─────────────────┤
│ Feelies strip                            [Saves] [New]     │
└────────────────────────────────────────────────────────────┘
```

- Center: terminal (primary).
- Left rail (~220px): inventory + compass.
- Right pane: map.
- Top: status + navigation.
- Bottom: feelies + save actions.

### Responsive

| Width | Behavior |
|-------|----------|
| Wide | Three-column workbench |
| Medium | Map as tab/drawer; terminal + left rail |
| Narrow | Terminal full width; tabs: Play \| Map \| Inv \| More |

After compass/inventory actions, keyboard focus returns to the command line (unless a modal is open).

### CRT aesthetic (V1)

- Dark background; green or amber phosphor text.
- Monospace transcript and input.
- Subtle scanlines and glow via CSS; honor `prefers-reduced-motion`.
- Shared palette for map/inventory chrome (not a conflicting flat design system).
- Single theme in V1.

### Terminal

| Feature | Spec |
|---------|------|
| Transcript | Scrollable; auto-scroll unless user scrolled up |
| Input | Single-line; Enter submits |
| History | ↑/↓ |
| Autocomplete | Tab + small candidate popover |
| Output | Preserve line breaks; wrap to panel width |

### Compass

- 8-dir + Up/Down + In/Out.
- Enabled when exit available in snapshot; dim/disabled otherwise.
- Click submits movement immediately.

### Inventory

- Scrollable list; empty state copy.
- Click insert; double-click examine.
- Truncate long names with tooltip.

### Status bar

- Show only fields present in snapshot.
- Game title from library metadata.

### Accessibility (light V1)

- `prefers-reduced-motion` respected.
- Visible focus rings.
- Compass hit targets ≥ 40px.
- Current room not color-only (shape/icon too).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App | Vite + React + TypeScript |
| Styling | CSS modules or plain CSS + CSS variables (CRT tokens) |
| State | Zustand (or minimal context if sufficient) |
| Z-machine | JS interpreter — concrete package locked during spike (e.g. ifvms or equivalent) |
| Persistence | IndexedDB (`idb` or similar) |
| Map | SVG + CSS transforms for pan/zoom |
| Tests | Vitest + React Testing Library |
| Tooling | ESLint + Prettier |

### Proposed repository layout

```
wfm-trinity/
  docs/superpowers/specs/
  docs/superpowers/plans/
  public/
  src/
    app/
    features/
      library/
      play/
      map/
      saves/
      feelies/
    zmachine/
    persistence/
    styles/
  README.md
```

---

## Error handling

| Situation | UX |
|-----------|-----|
| Bad/unsupported story | Library error; do not add or mark failed |
| Load/save failure | Banner/toast; retry; keep playing if possible |
| Interpreter crash | Freeze input; Restore autosave / Return to library |
| IDB quota exceeded | Explain; suggest removing games/feelies |

---

## Testing strategy

| Level | What |
|-------|------|
| Unit | MapGraph, command assist, `gameId` hash, save keying |
| Adapter | Mock interpreter implementing `TurnSnapshot` |
| Component | Terminal history/autocomplete, compass enable state, library import (mocked) |
| Manual | Trinity + 1–2 other Infocom files on local Chrome/Safari |
| Spike (first) | Interpreter selection, load, save/restore, location/inventory/exits |

---

## V1 success criteria

- [ ] Import a supported Z-machine story and play it intact in the CRT terminal.
- [ ] Map builds as rooms are visited; mouse pan and zoom work.
- [ ] Inventory and compass are clickable; status bar shows available fields.
- [ ] Autosave and per-game manual slots; Continue restores play + map.
- [ ] Library supports covers/metadata and feelies.
- [ ] Responsive workbench usable on narrower widths.
- [ ] Command history and autocomplete work.
- [ ] App runs locally on macOS via Vite with no required network.

---

## Implementation milestones

1. **Spike** — interpreter choice; load story; save/restore; read location/inventory/exits.
2. **Shell** — library import + play screen + terminal I/O.
3. **World panels** — status, inventory, compass wired to snapshots.
4. **Map** — graph growth, pan/zoom, persistence.
5. **Saves** — autosave, slots, continue / new game.
6. **Polish** — CRT, responsive, autocomplete/history, feelies/covers.
7. **Harden** — errors, README, multi-game manual pass.

---

## Backlog (explicitly not V1)

- Undo/redo
- Transcript export
- Click-to-act on words in transcript
- Verb palette
- Additional themes / deep a11y pass
- Sound
- Click-room pathfinding / auto-walk
- User-drag room layout on map
- Soft typo suggestions
- Hints / achievements
- Live IFDB network integration
- Desktop wrapper (Electron/Tauri)
- Save file export/import (unless trivial during spike)
- Official feelie map underlay

---

## Open implementation choices (resolve in spike/plan)

1. Exact JS Z-machine package and blorb support matrix.
2. Autosave ring size (1 vs last 3).
3. Default phosphor color (green vs amber) — pick one for V1 CRT tokens.

These do not block the design; they are decided during planning/spike with a short written note in the plan.
