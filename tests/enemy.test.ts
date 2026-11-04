import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { createEmptyLevel, type Level } from '../src/game/level';
import { createEnemyState, stepEnemy } from '../src/game/enemy';

const STEP = 1 / 120;

/** Flat ground on the bottom two rows, across `groundCols` columns. */
function makeLevel(groundCols = 20): Level {
  const level = createEmptyLevel(20, 12);
  for (let row = 10; row < level.rows; row++) {
    for (let col = 0; col < groundCols; col++) {
      level.solids[row]![col] = true;
    }
  }
  return level;
}

function run(level: Level, state: ReturnType<typeof createEnemyState>, seconds: number) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) stepEnemy(level, state, STEP);
}

describe('king patrol', () => {
  it('lands on the ground', () => {
    const level = makeLevel();
    const state = createEnemyState(5, 10, 1);
    run(level, state, 0.5);
    expect(state.onGround).toBe(true);
    expect(state.y).toBe(10 * CONFIG.TILE);
  });

  it('walks in the direction it faces', () => {
    const level = makeLevel();
    const state = createEnemyState(5, 10, 1);
    const startX = state.x;
    run(level, state, 1);
    expect(state.x).toBeGreaterThan(startX);
    expect(state.dir).toBe(1);
  });

  it('turns around at a wall', () => {
    const level = makeLevel();
    // Wall at column 12, two tiles tall.
    level.solids[8]![12] = true;
    level.solids[9]![12] = true;
    const state = createEnemyState(10, 10, 1);
    run(level, state, 2);
    expect(state.dir).toBe(-1);
    expect(state.x).toBeLessThan(12 * CONFIG.TILE);
  });

  it('turns around at the edge of a platform', () => {
    const level = makeLevel(9); // ground only under columns 0..8
    const state = createEnemyState(7, 10, 1);
    run(level, state, 2);
    expect(state.dir).toBe(-1);
    expect(state.x).toBeLessThanOrEqual(9 * CONFIG.TILE);
  });

  it('stops moving once dead', () => {
    const level = makeLevel();
    const state = createEnemyState(5, 10, 1);
    run(level, state, 0.5);
    state.alive = false;
    const x = state.x;
    run(level, state, 1);
    expect(state.x).toBe(x);
  });
});
