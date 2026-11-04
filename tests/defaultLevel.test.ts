import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { levelFromData, isSolid, type LevelData } from '../src/game/level';
import { createPlayerState, stepPlayer, type PlayerInput } from '../src/game/player';

/**
 * Loads the real level that ships in public/levels/level1.json and runs the
 * pure physics on it, so a broken saved map is caught by `pnpm test`.
 */
function loadDefaultLevel() {
  const path = fileURLToPath(new URL('../public/levels/level1.json', import.meta.url));
  return levelFromData(JSON.parse(readFileSync(path, 'utf8')) as LevelData);
}

const idle: PlayerInput = { left: false, right: false, up: false, down: false, jump: false, attack: false };
const STEP = 1 / 120;

describe('the shipped level', () => {
  it('has a spawn in open space', () => {
    const level = loadDefaultLevel();
    expect(isSolid(level, level.spawn.col, level.spawn.row)).toBe(false);
  });

  it('has solid ground under the spawn', () => {
    const level = loadDefaultLevel();
    expect(isSolid(level, level.spawn.col, level.spawn.row + 1)).toBe(true);
  });

  it('lets the player settle on the ground instead of falling through', () => {
    const level = loadDefaultLevel();
    const state = createPlayerState(level);
    for (let i = 0; i < 120; i++) stepPlayer(level, state, idle, STEP);
    expect(state.onGround).toBe(true);
    expect(state.y).toBe((level.spawn.row + 1) * level.tileSize);
  });

  it('contains at least one ladder to climb', () => {
    const level = loadDefaultLevel();
    const ladders = level.tiles.flat().filter((tile) => tile === 75 || tile === 92 || tile === 109);
    expect(ladders.length).toBeGreaterThan(0);
  });

  it('is completable by running right and hopping', () => {
    const level = loadDefaultLevel();
    const state = createPlayerState(level);
    // Bunny-hop bot: always run right, jump whenever grounded.
    for (let i = 0; i < 120 * 20; i++) {
      const keys: PlayerInput = { ...idle, right: true, jump: state.onGround };
      stepPlayer(level, state, keys, STEP);
    }
    expect(state.x).toBeGreaterThan((level.goal.col - 1) * level.tileSize);
  });
});
