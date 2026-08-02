# Infocom Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Vite/React web app that runs original Z-machine story files (any Infocom game) in a CRT workbench UI with live map, inventory, compass, autosave, library, and feelies.

**Architecture:** Browser Z-machine engine behind a narrow adapter; React UI consumes `TurnSnapshot` only. IndexedDB holds story blobs, saves, map graphs, metadata, and feelies. Map and panels are best-effort reads of interpreter state; all world-changing UI actions submit normal parser commands.

**Tech Stack:** Vite, React 18+, TypeScript, Zustand, Vitest, React Testing Library, `idb`, CSS variables (CRT). Z-machine package locked in Task 5 spike (candidate: `ifvms` / ZVM from Parchment ecosystem; adapter interface is stable either way).

## Global Constraints

- Story logic is never rewritten; only shell + interpreter.
- Do not commit copyrighted `.z3`–`.z8` / blorb story files to the repo.
- Local-only: no required network for play; no backend.
- Per-game isolation via `gameId` = SHA-256 of story bytes (hex).
- UI world actions → parser commands only (no teleport).
- Map nodes are visited-only; pan/zoom camera free; room click selects only.
- V1 CRT: single green phosphor theme; honor `prefers-reduced-motion`.
- macOS local dev: `npm run dev` → browser localhost.
- Spec: `docs/superpowers/specs/2026-08-02-infocom-workbench-design.md`

---

## File structure (create as tasks proceed)

```
wfm-trinity/
  docs/superpowers/specs/2026-08-02-infocom-workbench-design.md
  docs/superpowers/plans/2026-08-02-infocom-workbench.md
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  index.html
  README.md
  public/favicon.svg
  src/
    main.tsx
    App.tsx
    vite-env.d.ts
    styles/
      tokens.css          # CRT CSS variables
      global.css
    domain/
      types.ts            # shared domain types
      gameId.ts           # hashStoryBytes
      directions.ts       # dir constants + reverse
      verbs.ts            # autocomplete verb list
    persistence/
      db.ts               # idb schema + open
      libraryRepo.ts
      saveRepo.ts
      mapRepo.ts
      feeliesRepo.ts
    zmachine/
      types.ts            # adapter interfaces
      mockAdapter.ts      # tests + UI without real story
      createAdapter.ts    # factory → real or mock
      worldView.ts        # snapshot fields from engine state
      engines/
        zvmAdapter.ts     # real engine (chosen in spike)
    features/
      map/
        mapGraph.ts       # pure graph logic
        mapLayout.ts
        MapView.tsx
        MapView.module.css
      command/
        commandAssist.ts
      library/
        libraryStore.ts   # zustand
        LibraryScreen.tsx
        LibraryScreen.module.css
        CoverPlaceholder.tsx
      play/
        gameSession.ts    # orchestrates adapter + snapshot
        playStore.ts
        PlayWorkbench.tsx
        PlayWorkbench.module.css
        Terminal.tsx
        Terminal.module.css
        StatusBar.tsx
        InventoryPanel.tsx
        Compass.tsx
      saves/
        saveService.ts
        SaveModal.tsx
      feelies/
        FeeliesStrip.tsx
        FeelieViewer.tsx
    app/
      routes.tsx          # library vs play (simple state ok)
  src/**/*.test.ts
  src/**/*.test.tsx
```

---

### Task 1: Scaffold Vite React TypeScript app

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/styles/tokens.css`, `src/styles/global.css`, `public/favicon.svg`, `README.md`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: none
- Produces: runnable `npm run dev`, `npm test`, CRT CSS variables on `:root`

- [ ] **Step 1: Scaffold project**

```bash
cd /Users/jabroni/Projects/wfm-trinity
npm create vite@latest . -- --template react-ts
# If create refuses non-empty dir, manually add package.json from Vite react-ts template
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm install zustand idb
```

Configure `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 2: Add CRT tokens and global styles**

`src/styles/tokens.css`:

```css
:root {
  --crt-bg: #0a0f0a;
  --crt-fg: #33ff66;
  --crt-fg-dim: #1a993d;
  --crt-fg-bright: #9affb0;
  --crt-amber: #ffb000;
  --crt-panel: #0d140d;
  --crt-border: #1a4d28;
  --crt-danger: #ff4466;
  --crt-font: "IBM Plex Mono", "ui-monospace", "Cascadia Code", monospace;
  --crt-scanline-opacity: 0.08;
  --rail-width: 220px;
  --map-min-width: 280px;
  --status-height: 40px;
  --feelies-height: 56px;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --crt-scanline-opacity: 0;
  }
}
```

`src/styles/global.css` — import tokens; set `html, body, #root { height: 100%; margin: 0; background: var(--crt-bg); color: var(--crt-fg); font-family: var(--crt-font); }`.

- [ ] **Step 3: Minimal App + smoke test**

`src/App.tsx` renders `<h1>Infocom Workbench</h1>`.

`src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

it('renders title', () => {
  render(<App />)
  expect(screen.getByText(/infocom workbench/i)).toBeInTheDocument()
})
```

- [ ] **Step 4: Run tests and dev server**

```bash
npm test -- --run
npm run build
```

Expected: tests pass; build succeeds.

- [ ] **Step 5: README skeleton**

Document: local-only, user must supply story files, `npm install` / `npm run dev` / `npm test`, no copyrighted games in repo.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS app with CRT tokens"
```

---

### Task 2: Domain types, gameId, directions

**Files:**
- Create: `src/domain/types.ts`, `src/domain/gameId.ts`, `src/domain/directions.ts`, `src/domain/verbs.ts`
- Test: `src/domain/gameId.test.ts`, `src/domain/directions.test.ts`

**Interfaces:**
- Consumes: none
- Produces:

```ts
// types.ts
export type Direction =
  | 'north' | 'south' | 'east' | 'west'
  | 'northeast' | 'northwest' | 'southeast' | 'southwest'
  | 'up' | 'down' | 'in' | 'out'

export interface InventoryItem { id: string; name: string }
export interface ExitInfo { dir: Direction; label?: string; toId?: string }
export interface StatusInfo {
  score?: number
  moves?: number
  hours?: number
  minutes?: number
  locationName?: string
}
export type WaitingFor = 'line' | 'char' | 'finished'

export interface TurnSnapshot {
  transcriptDelta: string
  location: { id: string; name: string }
  inventory: InventoryItem[]
  exits: ExitInfo[]
  status: StatusInfo
  waitingFor: WaitingFor
}

export interface RoomNode {
  id: string
  name: string
  firstVisitTurn: number
  lastVisitTurn: number
  x: number
  y: number
}

export interface MapEdge {
  fromId: string
  toId: string
  dir: Direction | null
  bidirectional: boolean
}

export interface MapGraphState {
  gameId: string
  nodes: Record<string, RoomNode>
  edges: MapEdge[]
}

export interface GameMetadata {
  title: string
  author?: string
  year?: string
  ifid?: string
  series?: string
  notes?: string
}

export interface LibraryGame {
  gameId: string
  fileName: string
  importedAt: number
  lastPlayedAt?: number
  metadata: GameMetadata
  hasCover: boolean
}

export interface SaveSlotMeta {
  gameId: string
  slotId: string // 'autosave' | 'autosave-1'.. or user id
  name: string
  updatedAt: number
  locationName?: string
}

// gameId.ts
export async function hashStoryBytes(bytes: ArrayBuffer): Promise<string>

// directions.ts
export const CARDINAL_DIRS: Direction[]
export const ALL_DIRS: Direction[]
export function reverseDir(d: Direction): Direction
export function deltaForDir(d: Direction): { dx: number; dy: number }
export function commandForDir(d: Direction): string  // "north", "up", ...

// verbs.ts
export const COMMON_VERBS: string[]  // look, examine, take, drop, open, close, ...
```

- [ ] **Step 1: Write failing tests for gameId and reverseDir**

```ts
// gameId.test.ts
import { hashStoryBytes } from './gameId'

it('hashes deterministically', async () => {
  const a = await hashStoryBytes(new TextEncoder().encode('trinity').buffer)
  const b = await hashStoryBytes(new TextEncoder().encode('trinity').buffer)
  const c = await hashStoryBytes(new TextEncoder().encode('zork').buffer)
  expect(a).toBe(b)
  expect(a).not.toBe(c)
  expect(a).toMatch(/^[a-f0-9]{64}$/)
})
```

```ts
// directions.test.ts
import { reverseDir, deltaForDir, commandForDir } from './directions'

it('reverses cardinals', () => {
  expect(reverseDir('north')).toBe('south')
  expect(reverseDir('up')).toBe('down')
  expect(reverseDir('in')).toBe('out')
})

it('delta places north at -y', () => {
  expect(deltaForDir('north')).toEqual({ dx: 0, dy: -1 })
  expect(deltaForDir('east')).toEqual({ dx: 1, dy: 0 })
})

it('command is lowercase word', () => {
  expect(commandForDir('northwest')).toBe('northwest')
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --run src/domain
```

- [ ] **Step 3: Implement domain modules**

`hashStoryBytes` uses `crypto.subtle.digest('SHA-256', bytes)` and hex-encodes.

Implement `reverseDir` map, `deltaForDir` grid steps, `COMMON_VERBS` list (~30 classic IF verbs).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add domain types, gameId hash, directions"
```

---

### Task 3: IndexedDB persistence layer

**Files:**
- Create: `src/persistence/db.ts`, `src/persistence/libraryRepo.ts`, `src/persistence/saveRepo.ts`, `src/persistence/mapRepo.ts`, `src/persistence/feeliesRepo.ts`
- Test: `src/persistence/libraryRepo.test.ts`, `src/persistence/saveRepo.test.ts` (use `fake-indexeddb`)

**Interfaces:**
- Consumes: `LibraryGame`, `MapGraphState`, `SaveSlotMeta`, `gameId`
- Produces:

```ts
// db.ts
export const DB_NAME = 'infocom-workbench'
export const DB_VERSION = 1
export async function openDb(): Promise<IDBPDatabase<WorkbenchDB>>

// stores: games, storyBytes, covers, saves, maps, feelies

// libraryRepo.ts
export async function listGames(): Promise<LibraryGame[]>
export async function getGame(gameId: string): Promise<LibraryGame | undefined>
export async function putGame(game: LibraryGame, story: ArrayBuffer): Promise<void>
export async function getStoryBytes(gameId: string): Promise<ArrayBuffer | undefined>
export async function deleteGameCascade(gameId: string): Promise<void> // game+story+cover+saves+maps+feelies
export async function putCover(gameId: string, blob: Blob): Promise<void>
export async function getCover(gameId: string): Promise<Blob | undefined>
export async function updateMetadata(gameId: string, metadata: GameMetadata): Promise<void>
export async function touchLastPlayed(gameId: string, when?: number): Promise<void>

// saveRepo.ts
export interface SaveRecord {
  gameId: string
  slotId: string
  name: string
  updatedAt: number
  locationName?: string
  zmachineSave: ArrayBuffer  // engine quasistatic
  shell: { map: MapGraphState; history: string[] }
}
export async function putSave(record: SaveRecord): Promise<void>
export async function getSave(gameId: string, slotId: string): Promise<SaveRecord | undefined>
export async function listSaves(gameId: string): Promise<SaveSlotMeta[]>
export async function deleteSave(gameId: string, slotId: string): Promise<void>
export async function getLatestAutosave(gameId: string): Promise<SaveRecord | undefined>

// mapRepo.ts
export async function putMap(graph: MapGraphState): Promise<void>
export async function getMap(gameId: string): Promise<MapGraphState | undefined>

// feeliesRepo.ts
export interface FeelieMeta {
  id: string
  gameId: string
  name: string
  mime: string
  addedAt: number
}
export async function listFeelies(gameId: string): Promise<FeelieMeta[]>
export async function putFeelie(meta: FeelieMeta, blob: Blob): Promise<void>
export async function getFeelieBlob(id: string): Promise<Blob | undefined>
export async function deleteFeelie(id: string): Promise<void>
```

- [ ] **Step 1: Install fake-indexeddb and write libraryRepo test**

```bash
npm install -D fake-indexeddb
```

```ts
// libraryRepo.test.ts
import 'fake-indexeddb/auto'
import { putGame, listGames, getStoryBytes, deleteGameCascade } from './libraryRepo'
import { hashStoryBytes } from '../domain/gameId'

it('stores and lists a game', async () => {
  const bytes = new TextEncoder().encode('fake-z-story').buffer
  const gameId = await hashStoryBytes(bytes)
  await putGame(
    {
      gameId,
      fileName: 'test.z5',
      importedAt: Date.now(),
      metadata: { title: 'Test' },
      hasCover: false,
    },
    bytes,
  )
  const list = await listGames()
  expect(list.some((g) => g.gameId === gameId)).toBe(true)
  const round = await getStoryBytes(gameId)
  expect(new Uint8Array(round!)[0]).toBe(new Uint8Array(bytes)[0])
  await deleteGameCascade(gameId)
  expect(await listGames()).toHaveLength(0)
})
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Implement `db.ts` + repos with `idb`**

Schema object stores + keys as specified. `deleteGameCascade` deletes from all stores for `gameId`.

- [ ] **Step 4: Add saveRepo test (put/get/list)**

- [ ] **Step 5: Tests PASS; commit**

```bash
git commit -am "feat: IndexedDB library, save, map, feelies repos"
```

---

### Task 4: Z-machine adapter interface + mock adapter

**Files:**
- Create: `src/zmachine/types.ts`, `src/zmachine/mockAdapter.ts`, `src/zmachine/createAdapter.ts`
- Test: `src/zmachine/mockAdapter.test.ts`

**Interfaces:**
- Consumes: `TurnSnapshot`
- Produces:

```ts
// types.ts
export interface ZMachineAdapter {
  load(story: ArrayBuffer): Promise<TurnSnapshot>
  submit(line: string): Promise<TurnSnapshot>
  save(): Promise<ArrayBuffer>
  restore(data: ArrayBuffer): Promise<TurnSnapshot>
  getSnapshot(): TurnSnapshot
}

export type AdapterKind = 'mock' | 'zvm'
```

**Mock behavior (for tests and UI without story files):**
- On `load`: transcript = "Mock Zorkian Adventure\nYou are in the Meadow.\n>"; location `{ id: 'meadow', name: 'Meadow' }`; exits north→woods; empty inventory; score 0 moves 0; waitingFor `line`.
- On `submit('north')`: move to Woods; inventory unchanged; moves++.
- On `submit('take lamp')`: add lamp to inventory if in Woods.
- On `submit('inventory')` / look: appropriate text.
- `save`/`restore` serialize JSON state to ArrayBuffer.

- [ ] **Step 1: Write mockAdapter tests**

```ts
it('loads into meadow and moves north', async () => {
  const a = createMockAdapter()
  const s0 = await a.load(new ArrayBuffer(8))
  expect(s0.location.name).toBe('Meadow')
  const s1 = await a.submit('north')
  expect(s1.location.name).toBe('Woods')
  expect(s1.status.moves).toBe(1)
})

it('save restore roundtrips location', async () => {
  const a = createMockAdapter()
  await a.load(new ArrayBuffer(8))
  await a.submit('north')
  const blob = await a.save()
  await a.submit('south')
  const s = await a.restore(blob)
  expect(s.location.name).toBe('Woods')
})
```

- [ ] **Step 2: Implement mock; tests pass**

- [ ] **Step 3: `createAdapter(kind)` returns mock for now; real engine later**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: Z-machine adapter interface and mock engine"
```

---

### Task 5: Real Z-machine engine spike (gate)

**Files:**
- Create: `src/zmachine/engines/zvmAdapter.ts`, `src/zmachine/engines/SPIKE_NOTES.md`
- Modify: `src/zmachine/createAdapter.ts`, `package.json`
- Test: `src/zmachine/engines/zvmAdapter.test.ts` (skip if no fixture)

**Interfaces:**
- Consumes: `ZMachineAdapter`
- Produces: working `createZvmAdapter(): ZMachineAdapter` for raw `.z3`–`.z5` at minimum

- [ ] **Step 1: Research and install engine**

Evaluate packages that run in browser + Vite:
- Prefer engines used by Parchment / ifvms / zvm.
- Install chosen package; fix Vite prebundle if needed (`optimizeDeps.include`).

- [ ] **Step 2: Implement thin adapter**

Map engine I/O:
- Collect printed text into `transcriptDelta`.
- On input request, return snapshot with `waitingFor: 'line'`.
- Implement `save`/`restore` via engine API if present.

**World state extraction (minimum for spike):**
- Document in `SPIKE_NOTES.md` how to read player location object id, short name, inventory children, and score/moves for the chosen engine.
- If object tree is not exposed, implement interim heuristics and note gap — do not block shell, but mark WorldView incomplete.

- [ ] **Step 3: Manual verification**

User-supplied local file path (never commit):

```bash
# Place a legally obtained story at /tmp/test.z5 for local spike only
```

Write a small node/vitest integration test gated by env:

```ts
const path = process.env.STORY_FILE
const itor = path ? it : it.skip
itor('loads real story', async () => { /* read file, load, expect transcript length > 0 */ })
```

- [ ] **Step 4: Lock decision in SPIKE_NOTES.md**

Record: package name/version, formats supported, save/restore yes/no, object-tree yes/no, phosphor note N/A.

- [ ] **Step 5: Commit (no story files)**

```bash
git add src/zmachine package.json package-lock.json
git commit -m "feat: integrate real Z-machine engine behind adapter"
```

**Gate:** Do not proceed to play wiring with real games until `load` + `submit` work on at least one `.z` file locally. Mock path can continue for UI tasks in parallel after Task 4.

---

### Task 6: WorldView helpers

**Files:**
- Create: `src/zmachine/worldView.ts`
- Test: `src/zmachine/worldView.test.ts`

**Interfaces:**
- Consumes: engine-specific raw state OR normalized intermediate
- Produces:

```ts
export function buildStatus(partial: Partial<StatusInfo>): StatusInfo
export function mergeSnapshot(
  base: TurnSnapshot,
  overlay: Partial<TurnSnapshot>,
): TurnSnapshot
```

If zvmAdapter already builds full `TurnSnapshot`, WorldView holds pure helpers:

```ts
export function filterStatus(s: StatusInfo): StatusInfo
// drops undefined fields for UI
export function normalizeExitDir(raw: string): Direction | null
```

- [ ] **Step 1: Tests for normalizeExitDir and filterStatus**
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: world view helpers for status and exits"
```

---

### Task 7: MapGraph pure logic

**Files:**
- Create: `src/features/map/mapGraph.ts`, `src/features/map/mapLayout.ts`
- Test: `src/features/map/mapGraph.test.ts`

**Interfaces:**
- Consumes: `MapGraphState`, `Direction`, `TurnSnapshot`
- Produces:

```ts
export function emptyMap(gameId: string): MapGraphState

export function applyVisit(
  graph: MapGraphState,
  args: {
    location: { id: string; name: string }
    prevLocationId?: string
    movedDir?: Direction | null
    turn: number
    cellSize?: number // default 80
  },
): MapGraphState

export function selectRoom(graph: MapGraphState, roomId: string | null): string | null
```

**Layout rules:**
- First room at (0,0).
- New room: `prev + deltaForDir(movedDir) * cellSize`; if occupied, spiral nudge on grid.
- Never reflow existing x,y.
- Edges: add from→to with dir; if reverse exists, set bidirectional.

- [ ] **Step 1: Failing tests**

```ts
it('adds first room at origin', () => {
  let g = emptyMap('g1')
  g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
  expect(g.nodes['r1']).toMatchObject({ x: 0, y: 0, name: 'Meadow' })
})

it('places north room at dy -cellSize and adds edge', () => {
  let g = emptyMap('g1')
  g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
  g = applyVisit(g, {
    location: { id: 'r2', name: 'Woods' },
    prevLocationId: 'r1',
    movedDir: 'north',
    turn: 1,
    cellSize: 80,
  })
  expect(g.nodes['r2'].y).toBe(-80)
  expect(g.edges.some((e) => e.fromId === 'r1' && e.toId === 'r2' && e.dir === 'north')).toBe(true)
})

it('does not create unvisited destination nodes from exits alone', () => {
  // applyVisit only — no exit-table room creation API
  let g = emptyMap('g1')
  g = applyVisit(g, { location: { id: 'r1', name: 'Meadow' }, turn: 0 })
  expect(Object.keys(g.nodes)).toHaveLength(1)
})
```

- [ ] **Step 2: Implement until PASS**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: map graph growth and sticky layout"
```

---

### Task 8: CommandAssist

**Files:**
- Create: `src/features/command/commandAssist.ts`
- Test: `src/features/command/commandAssist.test.ts`

**Interfaces:**

```ts
export interface CommandAssistState {
  history: string[]
  historyIndex: number // history.length means "editing new"
  draft: string
}

export function emptyAssist(): CommandAssistState
export function pushHistory(state: CommandAssistState, line: string): CommandAssistState
export function historyUp(state: CommandAssistState): CommandAssistState
export function historyDown(state: CommandAssistState): CommandAssistState
export function autocomplete(
  input: string,
  candidates: string[],
): { completed: string; matches: string[] }
```

Rules:
- `pushHistory` ignores empty/whitespace; no consecutive duplicate.
- ↑ moves index back; sets draft to history entry.
- Autocomplete: complete **last token**; case-insensitive prefix; Tab cycles via caller passing next match.

- [ ] **Step 1: Tests for history and autocomplete**
- [ ] **Step 2: Implement PASS**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: command history and autocomplete helpers"
```

---

### Task 9: GameSession + SaveService (orchestration)

**Files:**
- Create: `src/features/play/gameSession.ts`, `src/features/saves/saveService.ts`
- Test: `src/features/play/gameSession.test.ts`, `src/features/saves/saveService.test.ts`

**Interfaces:**

```ts
// gameSession.ts
export interface SessionState {
  gameId: string
  snapshot: TurnSnapshot
  fullTranscript: string
  map: MapGraphState
  history: string[]
  turn: number
  prevLocationId?: string
  lastMoveDir?: Direction | null
  selectedRoomId?: string | null
}

export async function startNewSession(
  gameId: string,
  story: ArrayBuffer,
  adapter: ZMachineAdapter,
): Promise<SessionState>

export async function startFromSave(
  save: SaveRecord,
  story: ArrayBuffer,
  adapter: ZMachineAdapter,
): Promise<SessionState>

export async function submitCommand(
  session: SessionState,
  adapter: ZMachineAdapter,
  line: string,
): Promise<SessionState>
// trims line; adapter.submit; append transcript; applyVisit on map;
// detect move dir if line matches Direction

// saveService.ts
export async function autosave(
  session: SessionState,
  adapter: ZMachineAdapter,
): Promise<void>
// slotId 'autosave', name 'Autosave'

export async function saveSlot(
  session: SessionState,
  adapter: ZMachineAdapter,
  slotId: string,
  name: string,
): Promise<void>

export async function loadSlot(
  gameId: string,
  slotId: string,
  story: ArrayBuffer,
  adapter: ZMachineAdapter,
): Promise<SessionState>
```

- [ ] **Step 1: gameSession tests with mock adapter + fake-indexeddb if saves touched**

```ts
it('submit north updates map and transcript', async () => {
  const adapter = createMockAdapter()
  let s = await startNewSession('g', new ArrayBuffer(8), adapter)
  s = await submitCommand(s, adapter, 'north')
  expect(s.snapshot.location.name).toBe('Woods')
  expect(s.map.nodes[s.snapshot.location.id]).toBeTruthy()
  expect(s.fullTranscript.toLowerCase()).toContain('wood')
})
```

- [ ] **Step 2: saveService autosave roundtrip test**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Commit**

```bash
git commit -am "feat: game session orchestration and save service"
```

---

### Task 10: Zustand stores (library + play)

**Files:**
- Create: `src/features/library/libraryStore.ts`, `src/features/play/playStore.ts`
- Test: `src/features/library/libraryStore.test.ts`

**Interfaces:**

```ts
// libraryStore
interface LibraryState {
  games: LibraryGame[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  importFiles: (files: FileList | File[]) => Promise<void>
  removeGame: (gameId: string) => Promise<void>
  updateMeta: (gameId: string, metadata: GameMetadata) => Promise<void>
  setCover: (gameId: string, file: File) => Promise<void>
}

// playStore
interface PlayState {
  screen: 'library' | 'play'
  session: SessionState | null
  adapter: ZMachineAdapter | null
  error: string | null
  openGame: (gameId: string, mode: 'new' | 'continue' | { slotId: string }) => Promise<void>
  submit: (line: string) => Promise<void>
  returnToLibrary: () => void
  selectMapRoom: (roomId: string | null) => void
}
```

`importFiles`: read ArrayBuffer → hash → putGame with title from filename (strip extension).

`openGame continue`: `getLatestAutosave` or fail with error.

After `submit`: call `autosave` (catch errors → set soft error string, don't crash).

- [ ] **Step 1: Tests with mock adapter injection**
- [ ] **Step 2: Implement stores**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: library and play zustand stores"
```

---

### Task 11: Library screen UI

**Files:**
- Create: `src/features/library/LibraryScreen.tsx`, `src/features/library/LibraryScreen.module.css`, `src/features/library/CoverPlaceholder.tsx`
- Modify: `src/App.tsx`
- Test: `src/features/library/LibraryScreen.test.tsx`

**Interfaces:**
- Consumes: `libraryStore`, `playStore.openGame`
- Produces: import button, game cards, continue/new, delete confirm, metadata edit minimal (title field)

- [ ] **Step 1: Component test — shows empty state and import control**

```tsx
it('shows empty library message', () => {
  render(<LibraryScreen />)
  expect(screen.getByText(/import/i)).toBeInTheDocument()
  expect(screen.getByText(/no games/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Implement CRT-styled library grid**
- [ ] **Step 3: Wire App to show Library when `screen==='library'`**
- [ ] **Step 4: Manual: import is file input accept=".z3,.z4,.z5,.z6,.z7,.z8,.zblorb,.blorb,application/octet-stream"**
- [ ] **Step 5: Commit**

```bash
git commit -am "feat: library screen with import and game cards"
```

---

### Task 12: Terminal component

**Files:**
- Create: `src/features/play/Terminal.tsx`, `src/features/play/Terminal.module.css`
- Test: `src/features/play/Terminal.test.tsx`

**Interfaces:**

```tsx
export interface TerminalProps {
  transcript: string
  disabled?: boolean
  onSubmit: (line: string) => void
  candidates: string[]  // for autocomplete
}
```

Behavior:
- Scrollable pre/div for transcript; auto-scroll unless `userScrolledUp` ref.
- Input: Enter submits; ↑/↓ history via `commandAssist` local state.
- Tab: preventDefault; autocomplete last token from candidates.
- CRT bezel + scanline overlay (CSS); no animation if reduced motion.

- [ ] **Step 1: Test submit and history**

```tsx
it('submits typed command', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<Terminal transcript="Hello" onSubmit={onSubmit} candidates={['look']} />)
  const input = screen.getByRole('textbox')
  await user.type(input, 'look{enter}')
  expect(onSubmit).toHaveBeenCalledWith('look')
})
```

- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: CRT terminal with history and autocomplete"
```

---

### Task 13: Status, Inventory, Compass panels

**Files:**
- Create: `src/features/play/StatusBar.tsx`, `src/features/play/InventoryPanel.tsx`, `src/features/play/Compass.tsx`, shared `panels.module.css`
- Test: `src/features/play/Compass.test.tsx`, `src/features/play/InventoryPanel.test.tsx`

**Interfaces:**

```tsx
// StatusBar
{ title: string; status: StatusInfo }

// InventoryPanel
{ items: InventoryItem[]; onInsert: (name: string) => void; onExamine: (name: string) => void }

// Compass
{ exits: ExitInfo[]; onMove: (dir: Direction) => void }
```

Compass: buttons for ALL_DIRS (group 3x3 + ud/in/out). Enabled if `exits` has that `dir` OR always enable cardinals? **Spec: enable when exit known/available in snapshot.** If mock always lists exits, use that. Disabled buttons `aria-disabled` + dim class.

Inventory: click → onInsert; double-click → onExamine.

- [ ] **Step 1: Tests for enabled north and inventory click**
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: status bar, inventory, and compass panels"
```

---

### Task 14: MapView (SVG pan/zoom)

**Files:**
- Create: `src/features/map/MapView.tsx`, `src/features/map/MapView.module.css`
- Test: `src/features/map/MapView.test.tsx`

**Interfaces:**

```tsx
export interface MapViewProps {
  graph: MapGraphState
  currentRoomId: string
  selectedRoomId?: string | null
  exits: ExitInfo[]  // stubs for current room
  onSelectRoom: (id: string | null) => void
  onRecenter?: () => void
}
```

Implementation:
- SVG with `viewBox` controlled by camera state `{ x, y, k }`.
- Pointer drag on background → pan.
- Wheel → zoom toward cursor (clamp k 0.4–2.5).
- Nodes as `<g>` with rect + text; current room class `current`.
- Click node → onSelectRoom.
- Exit stubs: short lines from current room for dirs without known edge target.

- [ ] **Step 1: Render test with one node shows name**
- [ ] **Step 2: Implement pan/zoom**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: pannable zoomable SVG map view"
```

---

### Task 15: Play workbench layout + wiring

**Files:**
- Create: `src/features/play/PlayWorkbench.tsx`, `src/features/play/PlayWorkbench.module.css`
- Modify: `src/App.tsx`, `src/features/play/playStore.ts` (insert helpers if needed)
- Test: `src/features/play/PlayWorkbench.test.tsx`

**Layout:** CSS grid:

```
grid-template:
  "status status status" var(--status-height)
  "left terminal map" 1fr
  "feelies feelies feelies" var(--feelies-height)
  / var(--rail-width) 1fr minmax(var(--map-min-width), 34%);
```

Wire:
- Terminal onSubmit → `playStore.submit`
- Compass onMove → `submit(commandForDir(dir))`
- Inventory onInsert → expose ref/callback to Terminal insert (use playStore `draftInsert` string consumed by Terminal, or lift input state). **Preferred:** `playStore.pendingInsert: string | null` cleared after Terminal applies.
- Inventory onExamine → `submit('examine ' + name)`
- Map onSelectRoom → `selectMapRoom`
- Status from session
- candidates = COMMON_VERBS + inventory names + exit dirs

Focus: after compass/inventory, focus command textbox (`#command-input`).

- [ ] **Step 1: Integration test with mock — click north calls movement**

Use mock adapter via store seed helper `.__setTestSession` for tests only.

- [ ] **Step 2: Implement workbench**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: play workbench layout wired to session"
```

---

### Task 16: Saves UI + continue/new flow

**Files:**
- Create: `src/features/saves/SaveModal.tsx`
- Modify: `LibraryScreen.tsx`, `PlayWorkbench.tsx`, `playStore.ts`
- Test: `src/features/saves/SaveModal.test.tsx`

**Behavior:**
- Library card: if autosave exists, buttons Continue + New Game (New confirms wipe run).
- Play: Saves button opens modal — list slots, Save new (prompt name), Load, overwrite.
- Autosave already in submit path.
- `visibilitychange` / `pagehide` → best-effort autosave.

- [ ] **Step 1: Test modal lists slots**
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: save slots UI and continue/new game flow"
```

---

### Task 17: Feelies strip + cover upload

**Files:**
- Create: `src/features/feelies/FeeliesStrip.tsx`, `src/features/feelies/FeelieViewer.tsx`
- Modify: `LibraryScreen.tsx`, `PlayWorkbench.tsx`
- Test: `src/features/feelies/FeeliesStrip.test.tsx`

**Behavior:**
- List feelies for current game; add file input; click opens viewer modal.
- Images: `<img>`; text: `<pre>`; pdf: `<iframe src={objectURL}>`.
- Library: upload cover image on card menu; `CoverPlaceholder` shows monogram from title if no cover.

- [ ] **Step 1: Test empty strip shows add control**
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: feelies panel and cover images"
```

---

### Task 18: Responsive layout + CRT polish

**Files:**
- Modify: `PlayWorkbench.module.css`, `global.css`, `tokens.css`, panel CSS modules
- Test: optional visual manual only; add `src/features/play/responsive.test.tsx` that checks tab buttons exist when mocking matchMedia narrow — optional

**Breakpoints:**
- `max-width: 1100px`: map in drawer/tab.
- `max-width: 720px`: tabs Play | Map | Inv | More.

Tab state local to PlayWorkbench.

CRT polish: scanline pseudo-element, text-shadow glow on terminal text, panel borders `var(--crt-border)`.

- [ ] **Step 1: Implement media queries + tabs**
- [ ] **Step 2: Manual check at desktop and ~375px width**
- [ ] **Step 3: Commit**

```bash
git commit -am "feat: responsive workbench and CRT polish"
```

---

### Task 19: Error handling + README harden

**Files:**
- Modify: stores, `App.tsx`, `README.md`
- Create: `src/app/ErrorBanner.tsx`

**Behavior:**
- Surface `libraryStore.error` / `playStore.error` in banner with dismiss.
- Import failure: corrupt empty file → error string, no crash.
- Interpreter throw in submit → catch, set error, offer return to library.
- README: legal note, how to import Trinity, controls cheatsheet, data lives in IndexedDB, clearing site data wipes library.

- [ ] **Step 1: Test error banner renders message**
- [ ] **Step 2: Implement**
- [ ] **Step 3: Full test suite**

```bash
npm test -- --run
npm run build
```

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: error banner and README for local play"
```

---

### Task 20: Manual multi-game acceptance pass

**Files:**
- Modify: `SPIKE_NOTES.md` or create `docs/superpowers/MANUAL_TEST.md` with checklist results (no secrets/paths to illegal content)

- [ ] **Step 1: Run checklist from spec success criteria**

Using locally owned story files only:
1. Import game → appears in library.
2. New game → terminal output.
3. Move via compass → map gains node; pan/zoom work.
4. Take object → inventory updates; click inserts; double-click examines.
5. Autosave → reload page → Continue restores.
6. Manual save slot load works.
7. Feelie attach + view.
8. Cover upload.
9. Second different game → isolated saves/map.
10. Narrow viewport tabs work.

- [ ] **Step 2: Fix any P0 bugs found (small commits per fix)**
- [ ] **Step 3: Final commit**

```bash
git commit -am "docs: record manual acceptance checklist results"
```

---

## Spec coverage checklist (plan self-review)

| Spec requirement | Task(s) |
|------------------|---------|
| Intact Z-machine play | 4, 5, 9, 15 |
| Any Infocom / multi-game library | 3, 10, 11 |
| CRT aesthetic | 1, 12, 18 |
| Workbench layout A | 15, 18 |
| Live map visited-only | 7, 14, 15 |
| Mouse pan/zoom | 14 |
| Inventory clickable | 13, 15 |
| Compass/exits | 13, 15 |
| Status bar | 13, 15 |
| Autosave + per-game slots | 3, 9, 16 |
| Command history + autocomplete | 8, 12 |
| Covers/metadata | 3, 11, 17 |
| Feelies | 3, 17 |
| Responsive | 18 |
| Local macOS only | 1, 19 |
| No story files in repo | 1, 5, 19 |
| Backlog excluded | — not scheduled |

## Resolved V1 defaults (from open choices)

| Choice | Default |
|--------|---------|
| Phosphor | Green (`--crt-fg: #33ff66`) |
| Autosave ring | Single slot `autosave` (not last-3) |
| Engine package | Locked in Task 5 `SPIKE_NOTES.md` |

## Execution notes

- Prefer **mock adapter** for all UI unit tests; real engine only in Task 5 and Task 20.
- Never `git add` `*.z3` `*.z4` `*.z5` `*.z8` `*.zblorb` story files — add to `.gitignore` in Task 1:

```
*.z3
*.z4
*.z5
*.z6
*.z7
*.z8
*.zblorb
*.blorb
*.zmachine
```
