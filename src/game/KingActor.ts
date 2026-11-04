import * as ex from 'excalibur';
import { CONFIG } from './config';
import { type GameAssets, type KingAnimations } from './assets';
import { type Level } from './level';
import { type EnemyState, createEnemyState, stepEnemy } from './enemy';

/** Physics runs on a fixed timestep so feel does not depend on framerate. */
const STEP_MS = 1000 / 120;

/**
 * A King enemy. Walks back and forth like a Koopa, turning at walls and
 * ledges, and turns red and dies when cut by the player's sword.
 */
export class KingActor extends ex.Actor {
  readonly state: EnemyState;
  private readonly level: Level;
  private readonly animations: KingAnimations;
  private accumulator = 0;
  private deathTimer = 0;
  private dying = false;

  constructor(level: Level, col: number, row: number, assets: GameAssets) {
    const state = createEnemyState(col, row, -1);
    super({
      pos: ex.vec(state.x, state.y),
      width: CONFIG.ENEMY.width,
      height: CONFIG.ENEMY.height,
      anchor: ex.vec(0.5, 1),
      z: 9,
    });
    this.level = level;
    this.state = state;
    this.animations = assets.kingAnimations;
    this.graphics.use(this.animations.walk);
  }

  get isDying(): boolean {
    return this.dying;
  }

  /** Cut down by the sword: flash red, then remove. */
  cutDown(): void {
    if (this.dying) return;
    this.dying = true;
    this.state.alive = false;
    this.deathTimer = CONFIG.ENEMY.deathMs;
    this.animations.hurt.reset();
    this.animations.hurt.play();
    this.graphics.use(this.animations.hurt);
  }

  override onPreUpdate(_engine: ex.Engine, delta: number): void {
    if (this.dying) {
      this.deathTimer -= delta;
      this.graphics.opacity = Math.max(0, this.deathTimer / CONFIG.ENEMY.deathMs);
      if (this.deathTimer <= 0) this.kill();
      return;
    }

    this.accumulator += delta;
    while (this.accumulator >= STEP_MS) {
      stepEnemy(this.level, this.state, STEP_MS / 1000);
      this.accumulator -= STEP_MS;
    }

    this.pos.setTo(this.state.x, this.state.y);
    this.graphics.flipHorizontal = this.state.dir < 0;
  }
}
