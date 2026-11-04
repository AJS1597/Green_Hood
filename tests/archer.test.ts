import { describe, expect, it } from 'vitest';
import {
  arrowHits,
  createArcherState,
  stepArcher,
} from '../src/game/archer';
import { CONFIG } from '../src/game/config';

const groundedInput = {
  move: 0 as const,
  jump: false,
  jumpPressed: false,
  shoot: false,
};

describe('archer movement', () => {
  it('starts grounded on the floor', () => {
    const state = createArcherState();
    expect(state.grounded).toBe(true);
    expect(state.y).toBe(CONFIG.WORLD.groundY - CONFIG.PLAYER.height);
  });

  it('moves right when input is right', () => {
    const state = createArcherState();
    stepArcher(state, { ...groundedInput, move: 1 }, 0.1);
    expect(state.x).toBeGreaterThan(64);
    expect(state.facing).toBe(1);
  });

  it('moves left and turns to face left', () => {
    const state = createArcherState();
    stepArcher(state, { ...groundedInput, move: -1 }, 0.1);
    expect(state.x).toBeLessThan(64);
    expect(state.facing).toBe(-1);
  });

  it('jumps only on the rising edge', () => {
    const state = createArcherState();
    stepArcher(state, { ...groundedInput, jump: true, jumpPressed: false }, 0.016);
    expect(state.grounded).toBe(true);

    stepArcher(state, { ...groundedInput, jump: true, jumpPressed: true }, 0.016);
    expect(state.grounded).toBe(false);
    expect(state.vy).toBeLessThan(0);
  });

  it('cannot double jump while airborne', () => {
    const state = createArcherState();
    stepArcher(state, { ...groundedInput, jump: true, jumpPressed: true }, 0.016);
    const vyAfterFirst = state.vy;
    stepArcher(state, { ...groundedInput, jump: true, jumpPressed: true }, 0.016);
    expect(state.vy).toBeGreaterThan(vyAfterFirst);
  });

  it('clamps to the world bounds', () => {
    const state = createArcherState(0);
    for (let i = 0; i < 100; i++) {
      stepArcher(state, { ...groundedInput, move: -1 }, 0.1);
    }
    expect(state.x).toBeGreaterThanOrEqual(CONFIG.PLAYER.width / 2);
  });
});

describe('archer shooting', () => {
  it('fires an arrow and starts a cooldown', () => {
    const state = createArcherState();
    const result = stepArcher(state, { ...groundedInput, shoot: true }, 0.016);
    expect(result.fired).toBe(true);
    expect(result.muzzle).not.toBeNull();
    expect(state.cooldown).toBe(CONFIG.ARROW.cooldownMs);
  });

  it('cannot fire again during cooldown', () => {
    const state = createArcherState();
    stepArcher(state, { ...groundedInput, shoot: true }, 0.016);
    const second = stepArcher(state, { ...groundedInput, shoot: true }, 0.016);
    expect(second.fired).toBe(false);
  });

  it('fires again once the cooldown has elapsed', () => {
    const state = createArcherState();
    stepArcher(state, { ...groundedInput, shoot: true }, 0.016);
    const later = stepArcher(
      state,
      { ...groundedInput, shoot: true },
      CONFIG.ARROW.cooldownMs / 1000 + 0.01,
    );
    expect(later.fired).toBe(true);
  });

  it('spawns the muzzle on the facing side', () => {
    const right = createArcherState();
    const r = stepArcher(right, { ...groundedInput, move: 1, shoot: true }, 0.016);
    expect(r.muzzle?.x).toBeGreaterThan(right.x);

    const left = createArcherState();
    const l = stepArcher(left, { ...groundedInput, move: -1, shoot: true }, 0.016);
    expect(l.muzzle?.x).toBeLessThan(left.x);
  });
});

describe('arrow collision', () => {
  const target = { x: 100, y: 100, width: 44, height: 80 };

  it('detects an overlapping arrow', () => {
    expect(arrowHits({ x: 100, y: 100 }, target)).toBe(true);
  });

  it('rejects a distant arrow', () => {
    expect(arrowHits({ x: 500, y: 100 }, target)).toBe(false);
  });
});
