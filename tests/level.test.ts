import { describe, expect, it } from 'vitest';
import {
  createEmptyLevel,
  isLadder,
  isSolid,
  levelFromData,
  levelPixelSize,
  levelToData,
  tileAt,
} from '../src/game/level';

describe('level grid', () => {
  it('starts empty with no solids or tiles', () => {
    const level = createEmptyLevel(10, 8);
    expect(level.columns).toBe(10);
    expect(level.rows).toBe(8);
    expect(tileAt(level, 3, 4)).toBe(-1);
    expect(isSolid(level, 3, 4)).toBe(false);
  });

  it('treats out-of-bounds cells as empty and non-solid', () => {
    const level = createEmptyLevel(10, 8);
    expect(tileAt(level, -1, 0)).toBe(-1);
    expect(tileAt(level, 0, 99)).toBe(-1);
    expect(isSolid(level, 999, 999)).toBe(false);
    expect(isLadder(level, 999, 999)).toBe(false);
  });

  it('reports size in pixels', () => {
    const level = createEmptyLevel(10, 8);
    // default tile size comes from CONFIG.TILE (16)
    expect(levelPixelSize(level)).toEqual({ width: 10 * level.tileSize, height: 8 * level.tileSize });
  });
});

describe('ladders', () => {
  it('recognises the three ladder tiles', () => {
    const level = createEmptyLevel(4, 4);
    level.tiles[1]![0] = 75;
    level.tiles[1]![1] = 92;
    level.tiles[1]![2] = 109;
    expect(isLadder(level, 0, 1)).toBe(true);
    expect(isLadder(level, 1, 1)).toBe(true);
    expect(isLadder(level, 2, 1)).toBe(true);
    expect(isLadder(level, 3, 1)).toBe(false);
  });

  it('does not treat an ordinary tile as a ladder', () => {
    const level = createEmptyLevel(4, 4);
    level.tiles[0]![0] = 8; // grass top
    expect(isLadder(level, 0, 0)).toBe(false);
  });
});

describe('level JSON round-trip', () => {
  it('preserves tiles, solids, spawn and goal', () => {
    const level = createEmptyLevel(5, 4);
    level.tiles[3]![0] = 8;
    level.solids[3]![0] = true;
    level.spawn = { col: 1, row: 2 };
    level.goal = { col: 4, row: 0 };

    const restored = levelFromData(levelToData(level));

    expect(restored.tiles).toEqual(level.tiles);
    expect(restored.solids).toEqual(level.solids);
    expect(restored.spawn).toEqual({ col: 1, row: 2 });
    expect(restored.goal).toEqual({ col: 4, row: 0 });
  });

  it('fills missing data with safe defaults', () => {
    const level = levelFromData({ columns: 3, rows: 3 });
    expect(level.tiles).toHaveLength(3);
    expect(level.tiles[0]).toEqual([-1, -1, -1]);
    expect(level.solids[0]).toEqual([false, false, false]);
  });
});
