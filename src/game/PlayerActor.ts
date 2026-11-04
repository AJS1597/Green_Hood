import * as ex from 'excalibur';
import { CONFIG } from './config';
import type { GameAssets, PlayerAnimations } from './assets';
import { type Level } from './level';
import {
  type PlayerInput,
  type PlayerState,
  createPlayerState,
  stepPlayer,
} from './player';

/** Physics runs on a fixed timestep so feel does not depend on framerate. */
const STEP_MS = 1000 / 120;

/**
 * The animated green archer. Wraps the pure `stepPlayer` controller and picks
 * the right animation for the current state. The sprite is anchored at the
 * feet, matching the controller's coordinate system.
 */
export class PlayerActor extends ex.Actor {
  readonly state: PlayerState;
  private readonly level: Level;
  private readonly animations: PlayerAnimations;
  private accumulator = 0;
  private attacking = false;

  /** Fired when a swing starts, so the scene can spawn the swoosh + sound. */
  onAttack: ((x: number, y: number, facing: 1 | -1) => void) | null = null;
  /** Fired when a jump starts. */
  onJump: (() => void) | null = null;

  constructor(level: Level, assets: GameAssets) {
    const state = createPlayerState(level);
    super({
      pos: ex.vec(state.x, state.y),
      width: CONFIG.PLAYER.width,
      height: CONFIG.PLAYER.height,
      anchor: ex.vec(0.5, 1),
      z: 10,
    });
    this.level = level;
    this.state = state;
    this.animations = assets.animations;
    this.graphics.use(this.animations.idle);
  }

  /** Put the player back at the spawn point (e.g. after falling in a pit). */
  respawn(): void {
    Object.assign(this.state, createPlayerState(this.level));
    this.accumulator = 0;
  }

  override onPreUpdate(engine: ex.Engine, delta: number): void {
    const keyboard = engine.input.keyboard;
    const input: PlayerInput = {
      left: keyboard.isHeld(ex.Keys.Left),
      right: keyboard.isHeld(ex.Keys.Right),
      up: keyboard.isHeld(ex.Keys.Up),
      down: keyboard.isHeld(ex.Keys.Down),
      jump: keyboard.isHeld(ex.Keys.Z) || keyboard.isHeld(ex.Keys.Space),
      attack: keyboard.isHeld(ex.Keys.X),
    };

    // Fixed-step the simulation. The state tracks key edges, so repeating the
    // same input across sub-steps is safe.
    this.accumulator = Math.min(this.accumulator + delta, STEP_MS * 5);
    while (this.accumulator >= STEP_MS) {
      const events = stepPlayer(this.level, this.state, input, STEP_MS / 1000);
      if (events.jumped) this.onJump?.();
      if (events.attacked) this.onAttack?.(this.state.x, this.state.y, this.state.facing);
      this.accumulator -= STEP_MS;
    }

    this.pos.setTo(this.state.x, this.state.y);
    this.graphics.flipHorizontal = this.state.facing < 0;
    this.applyAnimation();
  }

  private applyAnimation(): void {
    const s = this.state;
    const isAttacking = s.attackTimer > 0;

    if (s.climbing) {
      this.graphics.use(this.animations.climb);
    } else if (isAttacking) {
      if (!this.attacking) {
        this.animations.attack.reset();
        this.animations.attack.play();
      }
      this.graphics.use(this.animations.attack);
    } else if (!s.onGround) {
      this.graphics.use(s.vy < 0 ? this.animations.jump : this.animations.fall);
    } else if (Math.abs(s.vx) > 8) {
      this.graphics.use(this.animations.run);
    } else {
      this.graphics.use(this.animations.idle);
    }

    this.attacking = isAttacking;
  }
}
