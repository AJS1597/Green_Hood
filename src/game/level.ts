import { LADDER_TILES } from './tileset';
import { CONFIG } from './config';

/**
 * ============================================================================
 *  LEVELS
 * ============================================================================
 *
 * A level is a grid of painted tiles. It is edited visually on the `/dev`
 * screen and saved to `public/levels/level1.json`.
 *
 * The file looks like this:
 *
 *   {
 *     "tileSize": 16,
 *     "columns": 60,
 *     "rows": 22,
 *     "spawn": { "col": 3, "row": 18 },
 *     "goal":  { "col": 55, "row": 18 },
 *     "tiles":  [[ -1, -1, 8, ... ], ...],   // one tile index per cell, -1 = empty
 *     "solids": [[  0,  0, 1, ... ], ...]    // 1 = collides
 *   }
 *
 * Tile indexes are row-major indexes into `sheet.png` (index = row * 17 + col),
 * so the format can describe every one of the 136 tiles. (A one-character-per-
 * tile ASCII format could not: there are only 95 printable ASCII characters.)
 */

export interface GridPoint {
  col: number;
  row: number;
}

/** The JSON on disk. */
export interface LevelData {
  tileSize: number;
  columns: number;
  rows: number;
  spawn: GridPoint;
  goal: GridPoint;
  /** `tiles[row][col]`, -1 for empty. */
  tiles: number[][];
  /** `solids[row][col]`, 1 for solid. */
  solids: number[][];
}

/** A validated level ready for the game to use. */
export interface Level {
  tileSize: number;
  columns: number;
  rows: number;
  spawn: GridPoint;
  goal: GridPoint;
  tiles: number[][];
  solids: boolean[][];
}

/** A blank level of the given size, with a spawn in the top-left corner. */
export function createEmptyLevel(columns: number, rows: number): Level {
  const tiles = Array.from({ length: rows }, () => new Array<number>(columns).fill(-1));
  const solids = Array.from({ length: rows }, () => new Array<boolean>(columns).fill(false));
  return {
    tileSize: CONFIG.TILE,
    columns,
    rows,
    spawn: { col: 1, row: 1 },
    goal: { col: columns - 2, row: rows - 2 },
    tiles,
    solids,
  };
}

/** Turn raw JSON into a safe Level, filling in any missing fields. */
export function levelFromData(data: Partial<LevelData>): Level {
  const columns = data.columns ?? 40;
  const rows = data.rows ?? 22;
  const base = createEmptyLevel(columns, rows);

  const tiles = base.tiles.map((row, r) =>
    row.map((_, c) => {
      const value = data.tiles?.[r]?.[c];
      return Number.isInteger(value) ? (value as number) : -1;
    }),
  );
  const solids = base.solids.map((row, r) =>
    row.map((_, c) => Boolean(data.solids?.[r]?.[c])),
  );

  return {
    tileSize: data.tileSize ?? CONFIG.TILE,
    columns,
    rows,
    spawn: data.spawn ?? base.spawn,
    goal: data.goal ?? base.goal,
    tiles,
    solids,
  };
}

/** Turn a Level back into the JSON we store on disk. */
export function levelToData(level: Level): LevelData {
  return {
    tileSize: level.tileSize,
    columns: level.columns,
    rows: level.rows,
    spawn: { ...level.spawn },
    goal: { ...level.goal },
    tiles: level.tiles.map((row) => [...row]),
    solids: level.solids.map((row) => row.map((solid) => (solid ? 1 : 0))),
  };
}

function inBounds(level: Level, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < level.columns && row < level.rows;
}

/** Tile index painted in a cell, or -1 for empty / out of bounds. */
export function tileAt(level: Level, col: number, row: number): number {
  if (!inBounds(level, col, row)) return -1;
  return level.tiles[row]?.[col] ?? -1;
}

/** Does this cell block movement? Out of bounds is empty (you fall out). */
export function isSolid(level: Level, col: number, row: number): boolean {
  if (!inBounds(level, col, row)) return false;
  return level.solids[row]?.[col] ?? false;
}

/** Is this cell a climbable ladder? */
export function isLadder(level: Level, col: number, row: number): boolean {
  return LADDER_TILES.has(tileAt(level, col, row));
}

/** Pixel width/height of the whole level. */
export function levelPixelSize(level: Level): { width: number; height: number } {
  return { width: level.columns * level.tileSize, height: level.rows * level.tileSize };
}
