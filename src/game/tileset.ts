/**
 * ============================================================================
 *  TILESET + ASSET FACTS  (no engine imports)
 * ============================================================================
 *
 * Plain constants describing the files in `public/assets/`. Kept free of any
 * Excalibur import so the level and player logic stay testable in plain Node.
 */

/** Base folder for runtime art + audio, relative to index.html. */
const ASSETS = 'assets/';

/** One entry per file on disk. Change a filename here and nowhere else. */
export const AssetPaths = {
  characters: `${ASSETS}characters.png`,
  tiles: `${ASSETS}sheet.png`,
  swoosh: `${ASSETS}swoosh.png`,
  music: `${ASSETS}music.ogg`,
  sfxSword: `${ASSETS}sfx-sword.wav`,
  sfxJump: `${ASSETS}sfx_Jump.wav`,
} as const;

/**
 * Grid layout of each image, measured by inspecting the files:
 * `columns x rows` cells of `spriteWidth x spriteHeight` pixels.
 */
export const SHEETS = {
  characters: { columns: 23, rows: 4, spriteWidth: 32, spriteHeight: 32 },
  tiles: { columns: 17, rows: 8, spriteWidth: 16, spriteHeight: 16 },
  swoosh: { columns: 4, rows: 1, spriteWidth: 32, spriteHeight: 32 },
} as const;

/** Total number of tiles in `sheet.png`. The editor exposes all of them. */
export const TILE_COUNT = SHEETS.tiles.columns * SHEETS.tiles.rows;

/**
 * Tile indexes with special meaning. Levels store raw tile indexes; these
 * sets tell the game how to interpret a painted tile.
 */
export const LADDER_TILES = new Set<number>([75, 92, 109]);

/**
 * Tiles the editor treats as solid by default when you paint them (the four
 * terrain blocks in `sheet.png`: grass tops and dirt bodies). Override any
 * cell with the Solid tool.
 */
export const SOLID_TILE_HINTS = new Set<number>([
  // autumn/red terrain (rows 0-1, columns 7-12)
  7, 8, 9, 10, 11, 12, 24, 25, 26, 27, 28, 29,
  // jungle/teal terrain (rows 2-3, columns 7-12, minus the leafy decor tile)
  41, 42, 43, 44, 45, 46, 58, 59, 60, 61, 63,
  // crate/window
  76,
]);

/** The chest tile the default level uses as its goal marker. */
export const GOAL_TILE = 82;

/**
 * Columns in the player's row (row 2) of `characters.png`.
 * Frame numbering follows the artist's notes on the asset page.
 */
export const PLAYER_FRAMES = {
  idle: 0,
  run: [14, 15, 16, 17],
  jump: 5, // moving upwards
  fall: 6, // moving downwards
  climb: [18, 19, 20, 21],
  attack: [11, 10, 11, 12], // the suggested slash order
} as const;

/** The green character is on row 2 of the characters spritesheet. */
export const PLAYER_ROW = 2;

/** The king (an enemy) is on row 1 of the characters spritesheet. */
export const KING_ROW = 1;

/** Animation columns for the king, following the same sheet layout. */
export const KING_FRAMES = {
  walk: [0, 1, 2, 3],
  hurt: [8, 9],
} as const;
