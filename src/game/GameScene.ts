import * as ex from 'excalibur';
import { CONFIG } from './config';
import {
  type ArcherInput,
  type ArcherState,
  arrowHits,
  createArcherState,
  stepArcher,
} from './archer';

interface Target {
  actor: ex.Actor;
  hit: boolean;
}

/**
 * The single playable room: an archer on a strip of ground, a few targets,
 * and a growing score.
 */
export class GameScene extends ex.Scene {
  private archer!: ArcherState;
  private playerActor!: ex.Actor;
  private arrows: ex.Actor[] = [];
  private targets: Target[] = [];
  private score = 0;
  private scoreEl: HTMLElement | null = null;
  private pointerShoot = false;
  private prevJump = false;

  override onInitialize(): void {
    this.scoreEl = document.getElementById('score');
    this.buildBackground();
    this.buildGround();
    this.buildPlayer();
    this.buildTargets();

    this.engine.input.pointers.on('down', () => {
      this.pointerShoot = true;
    });
  }

  private buildBackground(): void {
    const { VIEW } = CONFIG;
    const sky = new ex.Actor({
      pos: ex.vec(VIEW.width / 2, VIEW.height / 2),
      width: VIEW.width,
      height: VIEW.height,
      z: -10,
    });
    sky.graphics.use(
      new ex.Rectangle({
        width: VIEW.width,
        height: VIEW.height,
        color: ex.Color.fromHex('#0a150d'),
      }),
    );
    this.add(sky);
  }

  private buildGround(): void {
    const { WORLD, VIEW } = CONFIG;
    const ground = new ex.Actor({
      pos: ex.vec(VIEW.width / 2, WORLD.groundY + 40),
      width: VIEW.width,
      height: 80,
      z: -5,
    });
    ground.graphics.use(
      new ex.Rectangle({
        width: VIEW.width,
        height: 80,
        color: ex.Color.fromHex('#1c4d2a'),
      }),
    );
    this.add(ground);
  }

  private buildPlayer(): void {
    this.archer = createArcherState();
    this.playerActor = new ex.Actor({
      pos: ex.vec(this.archer.x, this.archer.y + CONFIG.PLAYER.height / 2),
      width: CONFIG.PLAYER.width,
      height: CONFIG.PLAYER.height,
      z: 5,
    });
    this.playerActor.graphics.use(
      new ex.Rectangle({
        width: CONFIG.PLAYER.width,
        height: CONFIG.PLAYER.height,
        color: ex.Color.fromHex('#2f9e4f'),
      }),
    );
    this.add(this.playerActor);
  }

  private buildTargets(): void {
    const { TARGET } = CONFIG;
    for (const x of [620, 980, 1340]) {
      const actor = new ex.Actor({
        pos: ex.vec(x, CONFIG.WORLD.groundY - TARGET.height / 2),
        width: TARGET.width,
        height: TARGET.height,
        z: 4,
      });
      actor.graphics.use(
        new ex.Rectangle({
          width: TARGET.width,
          height: TARGET.height,
          color: ex.Color.fromHex('#c9a227'),
        }),
      );
      this.add(actor);
      this.targets.push({ actor, hit: false });
    }
  }

  override onPreUpdate(_engine: ex.Engine, delta: number): void {
    const kb = this.engine.input.keyboard;
    const move: -1 | 0 | 1 =
      kb.isHeld(ex.Keys.Left) || kb.isHeld(ex.Keys.A)
        ? -1
        : kb.isHeld(ex.Keys.Right) || kb.isHeld(ex.Keys.D)
          ? 1
          : 0;
    const jump = kb.isHeld(ex.Keys.Space) || kb.isHeld(ex.Keys.Up);
    const shootKey = kb.isHeld(ex.Keys.J);
    const shoot = shootKey || this.pointerShoot;
    this.pointerShoot = false;

    const input: ArcherInput = {
      move,
      jump,
      jumpPressed: jump && !this.prevJump,
      shoot,
    };
    this.prevJump = jump;

    const dt = Math.min(delta / 1000, 1 / 30);
    const result = stepArcher(this.archer, input, dt);

    this.playerActor.pos.setTo(
      this.archer.x,
      this.archer.y + CONFIG.PLAYER.height / 2,
    );

    if (result.fired && result.muzzle) {
      this.spawnArrow(result.muzzle, this.archer.facing);
    }

    this.updateArrows(dt);
  }

  private spawnArrow(pos: { x: number; y: number }, facing: 1 | -1): void {
    const { ARROW } = CONFIG;
    const actor = new ex.Actor({
      pos: ex.vec(pos.x, pos.y),
      width: ARROW.width,
      height: ARROW.height,
      z: 6,
    });
    actor.graphics.use(
      new ex.Rectangle({
        width: ARROW.width,
        height: ARROW.height,
        color: ex.Color.fromHex('#e8dfb8'),
      }),
    );
    actor.vel = ex.vec(facing * ARROW.speed, 0);
    actor.on('exitviewport', () => actor.kill());
    this.add(actor);
    this.arrows.push(actor);
  }

  private updateArrows(dt: number): void {
    for (const arrow of this.arrows) {
      arrow.pos.x += arrow.vel.x * dt;
      if (arrow.pos.x < 0 || arrow.pos.x > CONFIG.WORLD.width) {
        arrow.kill();
        continue;
      }
      for (const target of this.targets) {
        if (target.hit) continue;
        if (arrowHits(arrow.pos, {
          x: target.actor.pos.x,
          y: target.actor.pos.y,
          width: CONFIG.TARGET.width,
          height: CONFIG.TARGET.height,
        })) {
          target.hit = true;
          target.actor.graphics.use(
            new ex.Rectangle({
              width: CONFIG.TARGET.width,
              height: CONFIG.TARGET.height,
              color: ex.Color.fromHex('#3fc46a'),
            }),
          );
          arrow.kill();
          this.score += CONFIG.TARGET.points;
          this.renderScore();
          break;
        }
      }
    }
    this.arrows = this.arrows.filter((a) => !a.isKilled());
  }

  private renderScore(): void {
    if (this.scoreEl) {
      this.scoreEl.textContent = `SCORE ${this.score}`;
    }
  }

  /** Reset the room: clear arrows, revive targets, zero the score. */
  resetRoom(): void {
    for (const arrow of this.arrows) arrow.kill();
    this.arrows = [];
    for (const target of this.targets) {
      target.hit = false;
      target.actor.graphics.use(
        new ex.Rectangle({
          width: CONFIG.TARGET.width,
          height: CONFIG.TARGET.height,
          color: ex.Color.fromHex('#c9a227'),
        }),
      );
    }
    this.archer = createArcherState();
    this.score = 0;
    this.renderScore();
  }
}
