# Task 5 spike notes — real Z-machine engine

## Decision

| Field | Value |
|-------|-------|
| **Package** | [`zmachine`](https://www.npmjs.com/package/zmachine) **v0.3.0** |
| **License** | MIT |
| **Why chosen** | Zero runtime deps, pure TypeScript ESM, works in browser + Vitest via Vite, clean `IOAdapter` (no GlkOte required), full object table + globals access, V1–V5/V7–V8 |
| **Vite** | Alias `zmachine` → `node_modules/zmachine/dist/zmachine.esm.min.js` because the package’s unpacked ESM uses extensionless relative imports Node/Vitest cannot resolve |

## Candidates evaluated

| Package | Result |
|---------|--------|
| **ifvms** (Parchment ZVM) | Works with GlkOte; requires full Glk API (`glkote-term` is TTY-oriented). Heavy for headless adapter; kept as reference only. |
| **emglken** (bocfel wasm) | Large WASM surface; overkill for spike. |
| **@bitblit/fabler** | Alpha, incomplete packaging. |
| **tszm / quendor** | Less mature APIs for browser adapter. |
| **zmachine** | **Selected** — headless `IOAdapter`, object tree, Quetzal path inside engine for game SAVE/RESTORE. |

## Formats supported

- Raw Z-code: **.z1–.z5, .z7–.z8** (V6 graphics not supported by package).
- Blorb (`.zblorb`): **not unwrapped by this adapter** — feed raw ZCOD bytes for now.
- Story files: **never commit**; load via UI / `STORY_FILE` for tests.

## I/O model

- Custom **BridgeIO** implements `IOAdapter`.
- `readLine` / `readChar` return Promises resolved by `submit()`.
- `load` / `submit` wait until the next input request, then build a `TurnSnapshot`.
- `transcriptDelta` = lower-window text since last settle.

## Save / restore

| Path | Status |
|------|--------|
| **Adapter `save()` / `restore()`** | Custom JSON blob magic `IWZ1`: dynamic RAM + `stack.serialize()` + PC + embedded story bytes. **Not Quetzal.** Sufficient for workbench autosave spike. |
| **In-game SAVE/RESTORE opcodes** | Engine supports Quetzal via optional `io.save` / `io.restore`; **not wired** yet (would need file picker). |
| **Mid-turn save** | Taken while blocked on `sread`; PC points at the read instruction; restore re-runs from that PC. |

## World state extraction

| Field | Source | Quality |
|-------|--------|---------|
| **Location id/name** | Global var 16 (Infocom G00) → object short name | Good for Infocom/Inform |
| **Score / moves** | Globals 17 / 18; time games → hours/minutes when FLAGS1 time bit set | Good |
| **Status line** | Optional `showStatusLine` if game calls `@show_status`; not all games do every turn | Partial |
| **Inventory** | Children of player object; player found among location children by name (`you` / `cretin` / `yourself` / `player`), else first child | Heuristic — works on Mini-Zork; may miss nonstandard player objects |
| **Exits** | **Not extracted** — object tree does not encode compass exits portably | Gap: leave `exits: []`; map graph learns from movement later |
| **Phosphor / display** | N/A | — |

## Gaps / follow-ups

1. Wire Quetzal for adapter-level saves (import or reimplement `createQuetzalSave`) so saves are portable to other interpreters.
2. Blorb unpack if library imports `.zblorb`.
3. Better player-object detection (e.g. Inform `selfobj` / attribute scan).
4. Exit graph from dictionary/compass verbs is out of scope; UI map should use move diffs.
5. Char-input prompts (Y/N) use first character of `submit` line — OK for spike.

## Manual verification

```bash
# Never commit story files. Example with IF Archive Mini-Zork (local only):
curl -fsSL -o /tmp/minizork.z3 \
  https://www.ifarchive.org/if-archive/infocom/demos/minizork.z3
STORY_FILE=/tmp/minizork.z3 npm test -- src/zmachine/engines/zvmAdapter.test.ts
# Or full suite (all zvm real-story cases + UI tests):
STORY_FILE=/tmp/minizork.z3 npm test -- --run
```

## Task 20 acceptance — remaining user checks

Full checklist with PASS / NEEDS_USER marks: **`docs/superpowers/MANUAL_TEST.md`**.

Automated path (2026-08-02): full Vitest suite green; Mini-Zork load/look/save-restore green with `STORY_FILE`. No P0 bugs found.

**What only a human with owned story files can finish:**

1. `npm run dev` → import **your** Infocom/Trinity (or Mini-Zork) via the library picker.
2. New game → CRT transcript; compass/typed moves → map growth; pan/zoom by mouse.
3. Take object → inventory click insert / double-click examine.
4. Hard-reload → **Continue** restores play + map; manual **Saves** slot load.
5. Cover upload + feelie attach/view on a real card.
6. Second different game → isolated saves/map.
7. Narrow viewport (~≤720px) Play|Map|Inv|More tabs.

Do **not** commit `.z3`–`.z8` / `.zblorb` / `.blorb` story files.

## Phosphor

N/A — this project uses a custom React transcript UI, not Phosphor.
