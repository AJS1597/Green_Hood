import { CONFIG } from './config';
import { type Level, isSolid } from './level';

/**
 * Pure, engine-free patrol physics for a Koopa-style enemy: it walks in one
 * direction, falls with gravity and flips around when it hits a wall or
 * reaches the edge of a platform.
 */

export interface EnemyState {
  /** Centre of the box. */
  x: number;
  /** Bottom (feet) of the box. */
  y: number;
  dir: 1 | -1;
  vy: number;
  onGround: boolean;
  /** Remaining sword hits. */
  hp: number;
  /** Once false the enemy stops updating (it is dying / dead). */
  alive: boolean;
}

const TILE = CONFIG.TILE;

/** Spawn an enemy standing in the given cell (feet on the tile below it). */
export function createEnemyState(col: number, row: number, dir: 1 | -1 = 1): EnemyState {
  return {
    x: col * TILE + TILE / 2,
    y: (row + 1) * TILE,
    dir,
    vy: 0,
    onGround: false,
    hp: CONFIG.ENEMY.hp,
    alive: true,
  };
}

/**
 * Apply one sword hit. Returns true if this hit was the killing blow.
 */
export function damageEnemy(state: EnemyState): boolean {
  if (!state.alive || state.hp <= 0) return false;
  state.hp -= 1;
  if (state.hp <= 0) {
    state.alive = false;
    return true;
  }
  return false;
}

function rowsOverlapping(state: EnemyState): { top: number; bottom: number } {
  const top = Math.floor((state.y - CONFIG.ENEMY.height + 0.5) / TILE);
  const bottom = Math.floor((state.y - 0.5) / TILE);
  return { top, bottom };
}

function colsOverlapping(state: EnemyState): { left: number; right: number } {
  const half = CONFIG.ENEMY.width / 2;
  return {
    left: Math.floor((state.x - half + 0.5) / TILE),
    right: Math.floor((state.x + half - 0.5) / TILE),
  };
}

/** Move horizontally; return true if a wall blocked the way. */
function moveX(level: Level, state: EnemyState, dx: number): boolean {
  state.x += dx;
  const half = CONFIG.ENEMY.width / 2;
  const { top, bottom } = rowsOverlapping(state);

  if (dx > 0) {
    const col = Math.floor((state.x + half) / TILE);
    for (let row = top; row <= bottom; row++) {
      if (isSolid(level, col, row)) {
        state.x = col * TILE - half;
        return true;
      }
    }
  } else if (dx < 0) {
    const col = Math.floor((state.x - half) / TILE);
    for (let row = top; row <= bottom; row++) {
      if (isSolid(level, col, row)) {
        state.x = (col + 1) * TILE + half;
        return true;
      }
    }
  }
  return false;
}

/** Move vertically, landing on solid ground. */
function moveY(level: Level, state: EnemyState, dy: number): void {
  state.y += dy;
  const { left, right } = colsOverlapping(state);

  if (dy > 0) {
    const row = Math.floor(state.y / TILE);
    for (let col = left; col <= right; col++) {
      if (isSolid(level, col, row)) {
        state.y = row * TILE;
        state.vy = 0;
        state.onGround = true;
        return;
      }
    }
  } else if (dy < 0) {
    const row = Math.floor((state.y - CONFIG.ENEMY.height) / TILE);
    for (let col = left; col <= right; col++) {
      if (isSolid(level, col, row)) {
        state.y = (row + 1) * TILE + CONFIG.ENEMY.height;
        state.vy = 0;
        return;
      }
    }
  }
}

/** Is there solid ground under the leading edge of the enemy? */
function groundAhead(level: Level, state: EnemyState): boolean {
  const half = CONFIG.ENEMY.width / 2;
  const probeX = state.dir > 0 ? state.x + half + 2 : state.x - half - 2;
  const col = Math.floor(probeX / TILE);
  const row = Math.floor((state.y + 2) / TILE);
  return isSolid(level, col, row);
}

/** Advance the enemy one fixed step. */
export function stepEnemy(level: Level, state: EnemyState, dt: number): void {
  if (!state.alive) return;
  const P = CONFIG.PHYSICS;

  // Gravity.
  state.vy = Math.min(state.vy + P.gravity * dt, P.maxFallSpeed);

  // Walk, turning around at walls and ledges.
  const blocked = moveX(level, state, state.dir * CONFIG.ENEMY.speed * dt);
  state.onGround = false;
  moveY(level, state, state.vy * dt);

  if (blocked) {
    state.dir = state.dir > 0 ? -1 : 1;
  } else if (state.onGround && !groundAhead(level, state)) {
    state.dir = state.dir > 0 ? -1 : 1;
  }
}
