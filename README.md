# Green Hood

A single-player platformer built with **Excalibur.js 0.32**, TypeScript, Vite and pnpm, using the CC0 art/audio from *A Platformer In The Forest* (Buch), *Swishes* (artisticdude) and *Dark Rooms and Scary Things* (isaiah658).

## Run it

```bash
pnpm install
pnpm dev
```

- **Play:** open the printed URL (`http://localhost:5173/`).
- **Edit the level:** add `/dev` → `http://localhost:5173/dev`.

```bash
pnpm test        # headless level + physics tests
pnpm typecheck
pnpm build       # production build in dist/
pnpm preview
```

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` / `→` |
| Climb ladders | `↑` / `↓` |
| Jump | `Z` (or `Space`) |
| Swing sword | `X` |
| Restart | `R` |

## Where the asset-loading code lives

Two small files, on purpose:

- **`src/game/tileset.ts`** — the plain facts: file paths (`AssetPaths`), sheet grids (`SHEETS`), and which tile indexes mean what (`LADDER_TILES`, `SOLID_TILE_HINTS`, `GOAL_TILE`, `PLAYER_FRAMES`). No engine imports, so the level/player logic stays testable in plain Node.
- **`src/game/assets.ts`** — imports those facts and actually loads them with Excalibur (`loadAssets()` builds the sprite sheets, the player animations, the swoosh animation and the sounds).

To add an asset: drop the file in `public/assets/`, add one line to `AssetPaths` in `tileset.ts`, and use it in `assets.ts`. Nothing else changes.

## The assets

All in `public/assets/` (Vite serves `public/` at the site root, so the runtime URLs are `assets/...`).

| File | What it is | Grid |
| --- | --- | --- |
| `characters.png` | player spritesheet (green character = row 2) | 23 × 4 cells of 32×32 |
| `sheet.png` | the tilesheet used to build levels | 17 × 8 cells of 16×16 |
| `swoosh.png` | 4-frame sword-slash effect | 4 × 1 cells of 32×32 |
| `music.ogg` | looping background music | — |
| `sfx-sword.wav` | sword swing (`swish-7`) | — |
| `sfx-jump.wav` | jump (`swish-4`) | — |

Licenses: every one of these is **CC0** (public domain). See `CREDITS.md`.

## Building a level with the tilesheet

Open `/dev`. The editor is a small tilemap tool:

1. **Palette** (left) lists every tile in `sheet.png`. Click one to select it. Tiles with a **red outline** are solid by default.
2. **Paint** with the brush: click or drag on the grid. Painting a "solid" tile also marks that cell as colliding; painting a decorative tile does not.
3. **Erase** clears a cell. **Solid** toggles collision on a cell by itself (shown as a red overlay). **Spawn** / **Goal** place the player start and the chest.
4. **Save** writes straight to `public/levels/level1.json` (through a tiny Vite dev middleware — see the `levelWriter` plugin in `vite.config.ts`). Reload the game and your map is there.

### The tilesheet grid, by hand

`sheet.png` is **17 columns × 8 rows of 16×16 tiles**. The index of a tile is `row * 17 + column` (row-major, 0-based). A few important ones:

| Tile | Index | Notes |
| --- | --- | --- |
| grass top (autumn) | `8` | surface tile, solid |
| dirt fill (autumn) | `28` | body under a surface, solid |
| grass/dirt (jungle) | `41` / `58` | second biome, solid |
| ladder top / middle / bottom | `75` / `92` / `109` | climbable, not solid |
| chest | `82` | used as the goal marker |

### Level file format

`public/levels/level1.json`:

```json
{
  "tileSize": 16,
  "columns": 60,
  "rows": 22,
  "spawn": { "col": 3, "row": 18 },
  "goal":  { "col": 55, "row": 18 },
  "tiles":  [[ -1, -1, 8, ... ]],
  "solids": [[  0,  0, 1, ... ]]
}
```

`tiles` is the visual layer (a tile index per cell, `-1` = empty); `solids` is the collision layer (`1` = blocks movement). Both are `row`-major.

**Why JSON and not one character per tile?** A tile index needs 136 distinct symbols, but there are only 95 printable ASCII characters — so a single-character-per-tile text map can't represent the whole sheet. JSON stores every tile and the collision layer without ambiguity, and still diffs cleanly in git.

## Architecture

```
src/
  game/
    tileset.ts       asset paths, sheet grids, tile indexes   (no engine)
    assets.ts        Excalibur loading: sheets, animations, sounds
    config.ts        tunables (gravity, speeds, camera)
    level.ts         LevelData <-> Level, isSolid/isLadder     (no engine)
    levelFile.ts     load/save level1.json
    player.ts        pure movement/jump/ladder/sword physics   (no engine)
    PlayerActor.ts   Excalibur actor: input, animation, sprite
    GameScene.ts     tilemap rendering, camera, sfx, goal
  editor/editor.ts   the /dev tilemap editor
  main.ts            route to game or editor
tests/               21 headless tests
```

### Key decisions

- **Pure logic, engine-free.** `player.ts` and `level.ts` import no Excalibur, so jump/ladder/collision feel is replayable in Vitest.
- **One baked canvas for the tilemap.** All painted tiles are drawn once into a canvas and shown as a single sprite.
- **Crisp integer scaling.** The 960×540 canvas is scaled by whole numbers and centred (`fitCanvasToWindow` in `main.ts`), so pixel art never gets the blurry, uneven look of fractional scaling. Leftover space is the same colour as the game background. `F` (or the button) toggles real browser fullscreen.
- **Custom grid collision**, not engine physics (`physics: false`) — deterministic and testable.
- **Tiles are data.** The level is a JSON grid, edited visually, not hard-coded in the source.

## Notes: guesses that were wrong (and got fixed)

Since this was built from the art rather than a spec sheet, a few things had to be measured and corrected:

1. **Ladder tile indexes.** A first look at a cropped screenshot put the ladder at `74 / 91 / 108`. Pixel analysis showed those cells are empty and the real ladder tiles are **`75 / 92 / 109`**. The crop had simply hidden an empty column, shifting the apparent label by one.
2. **Player animation frames.** The characters sheet has no per-frame labels; the ranges came from the artist's notes (walk 1–4, jump 5–8, run 15–18, climb 19–22). Mapping them to 0-based columns on **row 2** gives: idle `0`, run `14–17`, jump `5`, fall `6`, climb `18–21`, attack `11,10,11,12`.
3. **Sprite anchor.** The 32×32 frame has the character's feet near the bottom, so the actor anchor is `(0.5, 1.0)` (bottom-centre), matching the physics which stores the feet position.
4. **Collision edge.** The first collision resolver used a half-pixel epsilon that missed exact tile boundaries, so the player sank a third of a pixel into floors and walls. A test caught it; the lookup now uses `floor(y / tile)` and clamps exactly.
5. **Sword sound.** The first build used `swish-1`. Corrected to **`swish-7`** as requested. The audio is 24-bit WAV in the pack, so it is converted to 16-bit for reliable browser decoding.

## Credits

See `CREDITS.md`. All assets are CC0.
