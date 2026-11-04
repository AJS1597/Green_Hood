import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config';
import { createEmptyLevel, type Level } from '../src/game/level';
import { type PlayerInput, createPlayerState, stepPlayer } from '../src/game/player';

const STEP = 1 / 120;

/** A small test room: flat ground, a wall and a ladder. */
function makeLevel(): Level {
  const level = createEmptyLevel(20, 12);
  const groundTop = 10;
  for (let row = groundTop; row < level.rows; row++) {
    for (let col = 0; col < level.columns; col++) {
      level.solids[row]![col] = true;
      level.tiles[row]![col] = 8;
    }
  }
  // Wall two tiles tall at column 8.
  level.solids[8]![8] = true;
  level.solids[9]![8] = true;
  // Ladder at column 5, from the ground up.
  for (let row = 6; row <= 9; row++) level.tiles[row]![5] = 92;

  level.spawn = { col: 2, row: groundTop - 1 };
  return level;
}

function input(partial: Partial<PlayerInput> = {}): PlayerInput {
  return { left: false, right: false, up: false, down: false, jump: false, attack: false, ...partial };
}

function run(level: Level, state: ReturnType<typeof createPlayerState>, keys: Partial<PlayerInput>, seconds: number) {
  const steps = Math.round(seconds / STEP);
  let last = { jumped: false, attacked: false };
  for (let i = 0; i < steps; i++) {
    last = stepPlayer(level, state, input(keys), STEP);
  }
  return last;
}

describe('movement', () => {
  it('rests on the ground', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    run(level, state, {}, 0.5);
    expect(state.onGround).toBe(true);
    expect(state.y).toBe(10 * CONFIG.TILE);
  });

  it('runs to the right and faces right', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    run(level, state, { right: true }, 0.5);
    expect(state.x).toBeGreaterThan(2 * CONFIG.TILE);
    expect(state.facing).toBe(1);
  });

  it('is stopped by a wall', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    run(level, state, { right: true }, 2);
    // Column 8 starts at x = 128; the box is 10 wide so its centre stops at 123.
    expect(state.x).toBeLessThanOrEqual(8 * CONFIG.TILE - CONFIG.PLAYER.width / 2 + 0.01);
  });
});

describe('jumping', () => {
  it('leaves the ground on a jump press', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    run(level, state, {}, 0.2); // settle on the ground
    const events = stepPlayer(level, state, input({ jump: true }), STEP);
    expect(events.jumped).toBe(true);
    expect(state.vy).toBeLessThan(0);
  });

  it('comes back down and lands again', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    run(level, state, {}, 0.2);
    stepPlayer(level, state, input({ jump: true }), STEP);
    const peak = state.y;
    run(level, state, { jump: true }, 1.5);
    expect(state.y).toBeLessThanOrEqual(10 * CONFIG.TILE + 0.01);
    expect(state.onGround).toBe(true);
    expect(peak).toBeLessThan(10 * CONFIG.TILE);
  });

  it('does not double jump in mid-air', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    run(level, state, {}, 0.2);
    stepPlayer(level, state, input({ jump: true }), STEP);
    const vyAfterFirst = state.vy;
    // Release then press again while airborne: no new upward impulse.
    stepPlayer(level, state, input({ jump: false }), STEP);
    stepPlayer(level, state, input({ jump: true }), STEP);
    expect(state.vy).toBeGreaterThan(vyAfterFirst);
  });
});

describe('ladders', () => {
  it('climbs up while holding up on a ladder', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    // Move to the ladder column first.
    state.x = 5 * CONFIG.TILE + CONFIG.TILE / 2;
    run(level, state, {}, 0.2);
    expect(state.onLadder).toBe(true);
    const startY = state.y;
    run(level, state, { up: true }, 0.5);
    expect(state.climbing).toBe(true);
    expect(state.y).toBeLessThan(startY);
  });
});

describe('attack', () => {
  it('starts a swing on the attack press', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    run(level, state, {}, 0.2);
    const events = stepPlayer(level, state, input({ attack: true }), STEP);
    expect(events.attacked).toBe(true);
    expect(state.attackTimer).toBeGreaterThan(0);
    expect(state.attackCooldown).toBeGreaterThan(0);
  });

  it('respects the cooldown', () => {
    const level = makeLevel();
    const state = createPlayerState(level);
    run(level, state, {}, 0.2);
    stepPlayer(level, state, input({ attack: true }), STEP);
    const second = stepPlayer(level, state, input({ attack: false }), STEP);
    const third = stepPlayer(level, state, input({ attack: true }), STEP);
    expect(second.attacked).toBe(false);
    expect(third.attacked).toBe(false);
  });
});
