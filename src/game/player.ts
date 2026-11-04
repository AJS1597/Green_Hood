import { CONFIG } from './config';
import { type Level, isLadder, isSolid } from './level';

/**
 * Pure, engine-free platformer physics.
 *
 * `stepPlayer` takes a state, an input snapshot and a timestep and returns the
 * next state. It has no Excalibur imports, so the feel of the game (jump,
 * coyote time, ladders, walls) can be replayed in headless tests.
 *
 * Coordinates: `x` is the centre of the player's box, `y` is the bottom
 * (the feet). The sprite is anchored to the same point.
 */

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  onLadder: boolean;
  climbing: boolean;
  /** Milliseconds remaining in the current sword swing. */
  attackTimer: number;
  /** Milliseconds until another swing is allowed. */
  attackCooldown: number;
  /** Milliseconds of "coyote time" left since last touching the ground. */
  coyote: number;
  /** Milliseconds a queued jump stays valid. */
  jumpBuffer: number;
  /** Internal: was the jump key held last step (for edge detection). */
  jumpHeld: boolean;
  /** Internal: was the attack key held last step. */
  attackHeld: boolean;
}

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  attack: boolean;
}

export interface StepEvents {
  /** A jump was started this step. */
  jumped: boolean;
  /** A sword swing started this step. */
  attacked: boolean;
}

const TILE = CONFIG.TILE;

const emptyInput: PlayerInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  attack: false,
};

/** Spawn a new player with its feet on the spawn tile. */
export function createPlayerState(level: Level): PlayerState {
  return {
    // Spawn marker sits in an empty cell; feet rest on the tile below it.
    x: level.spawn.col * TILE + TILE / 2,
    y: (level.spawn.row + 1) * TILE,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    onLadder: false,
    climbing: false,
    attackTimer: 0,
    attackCooldown: 0,
    coyote: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    attackHeld: false,
  };
}

function rowsOverlapping(state: PlayerState): { top: number; bottom: number } {
  const top = Math.floor((state.y - CONFIG.PLAYER.height + 0.5) / TILE);
  const bottom = Math.floor((state.y - 0.5) / TILE);
  return { top, bottom };
}

function colsOverlapping(state: PlayerState): { left: number; right: number } {
  const half = CONFIG.PLAYER.width / 2;
  const left = Math.floor((state.x - half + 0.5) / TILE);
  const right = Math.floor((state.x + half - 0.5) / TILE);
  return { left, right };
}

/** Is any ladder tile overlapping the player's centre column? */
function ladderUnderFoot(level: Level, state: PlayerState): boolean {
  const col = Math.floor(state.x / TILE);
  const { top, bottom } = rowsOverlapping(state);
  for (let row = top; row <= bottom; row++) {
    if (isLadder(level, col, row)) return true;
  }
  return false;
}

/** Move horizontally, then push out of any solid tile hit. */
function moveAndCollideX(level: Level, state: PlayerState, dx: number): void {
  state.x += dx;
  const half = CONFIG.PLAYER.width / 2;
  const { top, bottom } = rowsOverlapping(state);

  if (dx > 0) {
    const col = Math.floor((state.x + half) / TILE);
    for (let row = top; row <= bottom; row++) {
      if (isSolid(level, col, row)) {
        state.x = col * TILE - half;
        state.vx = 0;
        break;
      }
    }
  } else if (dx < 0) {
    const col = Math.floor((state.x - half) / TILE);
    for (let row = top; row <= bottom; row++) {
      if (isSolid(level, col, row)) {
        state.x = (col + 1) * TILE + half;
        state.vx = 0;
        break;
      }
    }
  }
}

/** Move vertically, then push out of any solid tile hit, tracking ground. */
function moveAndCollideY(level: Level, state: PlayerState, dy: number): void {
  state.y += dy;
  const { left, right } = colsOverlapping(state);

  if (dy > 0) {
    const row = Math.floor(state.y / TILE);
    for (let col = left; col <= right; col++) {
      if (isSolid(level, col, row)) {
        state.y = row * TILE;
        state.vy = 0;
        state.onGround = true;
        break;
      }
    }
  } else if (dy < 0) {
    const row = Math.floor((state.y - CONFIG.PLAYER.height) / TILE);
    for (let col = left; col <= right; col++) {
      if (isSolid(level, col, row)) {
        state.y = (row + 1) * TILE + CONFIG.PLAYER.height;
        state.vy = 0;
        break;
      }
    }
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

/**
 * Advance the player one fixed step.
 *
 * @param dt seconds. Call this from a fixed 1/120s accumulator for stable feel.
 */
export function stepPlayer(
  level: Level,
  state: PlayerState,
  input: PlayerInput,
  dt: number,
): StepEvents {
  const P = CONFIG.PHYSICS;
  const events: StepEvents = { jumped: false, attacked: false };
  const ms = dt * 1000;

  // --- timers ---------------------------------------------------------------
  state.attackTimer = Math.max(0, state.attackTimer - ms);
  state.attackCooldown = Math.max(0, state.attackCooldown - ms);
  state.coyote = Math.max(0, state.coyote - ms);
  state.jumpBuffer = Math.max(0, state.jumpBuffer - ms);

  const jumpEdge = input.jump && !state.jumpHeld;
  const attackEdge = input.attack && !state.attackHeld;
  const jumpReleased = state.jumpHeld && !input.jump;
  state.jumpHeld = input.jump;
  state.attackHeld = input.attack;

  // --- ladders --------------------------------------------------------------
  const onLadder = ladderUnderFoot(level, state);
  state.onLadder = onLadder;

  if (onLadder && (input.up || input.down)) {
    state.climbing = true;
  }
  if (!onLadder) {
    state.climbing = false;
  }

  // Leaving the ladder by jumping off.
  if (state.climbing && jumpEdge) {
    state.climbing = false;
    state.vy = -P.jumpSpeed;
    events.jumped = true;
  }

  // --- horizontal -----------------------------------------------------------
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) state.facing = dir > 0 ? 1 : -1;

  if (state.climbing) {
    // Snap toward the middle of the ladder column when not steering.
    const centre = (Math.floor(state.x / TILE) + 0.5) * TILE;
    if (dir === 0) {
      state.x = approach(state.x, centre, P.ladderSnapSpeed * dt);
      state.vx = 0;
    } else {
      state.vx = dir * P.moveSpeed;
    }
  } else {
    const accel = state.onGround ? P.groundAccel : P.airAccel;
    if (dir !== 0) {
      state.vx = approach(state.vx, dir * P.moveSpeed, accel * dt);
    } else {
      const friction = state.onGround ? P.groundFriction : P.airAccel * 0.5;
      state.vx = approach(state.vx, 0, friction * dt);
    }
  }

  // --- jump buffering & coyote time -----------------------------------------
  if (jumpEdge) state.jumpBuffer = P.jumpBufferMs;
  const canJump = state.onGround || state.coyote > 0;

  if (!state.climbing && state.jumpBuffer > 0 && canJump) {
    state.vy = -P.jumpSpeed;
    state.jumpBuffer = 0;
    state.coyote = 0;
    state.onGround = false;
    events.jumped = true;
  }

  // Variable jump height: cut the rise once, on the frame the key is released.
  if (!state.climbing && jumpReleased && state.vy < 0) {
    state.vy *= P.jumpCutMultiplier;
  }

  // --- gravity --------------------------------------------------------------
  if (state.climbing) {
    const up = input.up ? 1 : 0;
    const down = input.down ? 1 : 0;
    state.vy = (down - up) * P.ladderClimbSpeed;
  } else {
    state.vy = Math.min(state.vy + P.gravity * dt, P.maxFallSpeed);
  }

  // --- integrate + collide --------------------------------------------------
  state.onGround = false;
  moveAndCollideX(level, state, state.vx * dt);
  moveAndCollideY(level, state, state.vy * dt);

  if (state.onGround) {
    state.coyote = P.coyoteTimeMs;
  }

  // --- attack ---------------------------------------------------------------
  if (attackEdge && state.attackCooldown === 0) {
    state.attackTimer = CONFIG.COMBAT.attackMs;
    state.attackCooldown = CONFIG.COMBAT.attackCooldownMs;
    events.attacked = true;
  }

  return events;
}

/** Convenience for tests: step with no keys pressed. */
export function stepIdle(level: Level, state: PlayerState, dt: number): StepEvents {
  return stepPlayer(level, state, emptyInput, dt);
}
