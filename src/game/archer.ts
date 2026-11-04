import { CONFIG } from './config';

/**
 * Pure, engine-free movement + shooting state for the archer.
 *
 * Keeping this free of Excalibur imports lets the rules of the game be
 * replayed in headless tests.
 */
export interface ArcherState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  /** Remaining shoot cooldown in milliseconds. */
  cooldown: number;
}

export interface ArcherInput {
  /** -1 left, 1 right, 0 idle. */
  move: -1 | 0 | 1;
  jump: boolean;
  shoot: boolean;
  /**
   * Whether the jump key was freshly pressed this frame (edge). A jump only
   * starts on the rising edge while grounded.
   */
  jumpPressed: boolean;
}

export function createArcherState(x = 64): ArcherState {
  return {
    x,
    y: CONFIG.WORLD.groundY - CONFIG.PLAYER.height,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 1,
    cooldown: 0,
  };
}

export interface StepResult {
  /** True when a shot was fired this step. */
  fired: boolean;
  /** Muzzle position of the fired arrow, or null. */
  muzzle: { x: number; y: number } | null;
}

/**
 * Advance the archer by one fixed step.
 *
 * @param dt seconds since the previous step.
 */
export function stepArcher(
  state: ArcherState,
  input: ArcherInput,
  dt: number,
): StepResult {
  const { PLAYER, WORLD } = CONFIG;

  // Horizontal movement is instantaneous in this prototype.
  state.vx = input.move * PLAYER.moveSpeed;
  if (input.move !== 0) {
    state.facing = input.move;
  }

  // Jump only on the rising edge while grounded.
  if (input.jumpPressed && input.jump && state.grounded) {
    state.vy = -PLAYER.jumpSpeed;
    state.grounded = false;
  }

  // Gravity.
  state.vy += PLAYER.gravity * dt;

  state.x += state.vx * dt;
  state.y += state.vy * dt;

  // Ground and world bounds.
  const floor = WORLD.groundY - PLAYER.height;
  if (state.y >= floor) {
    state.y = floor;
    state.vy = 0;
    state.grounded = true;
  }
  const half = PLAYER.width / 2;
  state.x = Math.max(half, Math.min(WORLD.width - half, state.x));

  let fired = false;
  let muzzle: { x: number; y: number } | null = null;

  state.cooldown = Math.max(0, state.cooldown - dt * 1000);
  if (input.shoot && state.cooldown === 0) {
    fired = true;
    muzzle = {
      x: state.x + state.facing * (PLAYER.width / 2 + 6),
      y: state.y + PLAYER.height * 0.35,
    };
    state.cooldown = CONFIG.ARROW.cooldownMs;
  }

  return { fired, muzzle };
}

/** True when an arrow's AABB overlaps a target's AABB. */
export function arrowHits(
  arrow: { x: number; y: number },
  target: { x: number; y: number; width: number; height: number },
): boolean {
  const aHalfW = CONFIG.ARROW.width / 2;
  const aHalfH = CONFIG.ARROW.height / 2;
  return (
    Math.abs(arrow.x - target.x) <= target.width / 2 + aHalfW &&
    Math.abs(arrow.y - target.y) <= target.height / 2 + aHalfH
  );
}
