import * as ex from 'excalibur';
import { CONFIG } from './config';
import { SHEETS, type GameAssets } from './assets';
import { type Level, levelPixelSize } from './level';
import { PlayerActor } from './PlayerActor';
import { KingActor } from './KingActor';
import { playSound } from './audio';

interface Effect {
  actor: ex.Actor;
  ttl: number;
}

/**
 * The playable scene: draws the painted tilemap, spawns the player and the
 * Kings placed in the level, follows the player with the camera and fires the
 * sound and slash effects.
 */
export class GameScene extends ex.Scene {
  private readonly level: Level;
  private readonly assets: GameAssets;
  private player!: PlayerActor;
  private kings: KingActor[] = [];
  private effects: Effect[] = [];
  private won = false;

  constructor(level: Level, assets: GameAssets) {
    super();
    this.level = level;
    this.assets = assets;
  }

  override onInitialize(): void {
    this.buildBackground();
    this.add(this.buildLevelGraphic());

    this.player = new PlayerActor(this.level, this.assets);
    this.player.onJump = () => playSound(this.assets.sounds.jump);
    this.player.onAttack = (x, y, facing) => {
      this.spawnSwoosh(x, y, facing);
      playSound(this.assets.sounds.sword);
      this.resolveSwordHits();
    };
    this.add(this.player);

    this.spawnKings();

    this.camera.strategy.limitCameraBounds(
      new ex.BoundingBox(0, 0, levelPixelSize(this.level).width, levelPixelSize(this.level).height),
    );
    this.camera.strategy.lockToActor(this.player);
    this.applyZoom();

    window.addEventListener('resize', () => this.applyZoom());

    this.engine.input.keyboard.on('press', (event) => {
      if (event.key === ex.Keys.R) {
        this.restart();
      }
    });

    this.setMessage('');
  }

  override onActivate(): void {
    this.applyZoom();
  }

  /**
   * Pick an integer zoom from the window height so the world always maps to
   * whole screen pixels (crisp), while filling the window.
   */
  private applyZoom(): void {
    const { targetViewHeight, minZoom, maxZoom } = CONFIG.CAMERA;
    const zoom = Math.round(window.innerHeight / targetViewHeight);
    this.camera.zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
  }

  private buildBackground(): void {
    const { width, height } = levelPixelSize(this.level);
    const background = new ex.Actor({
      pos: ex.vec(0, 0),
      anchor: ex.vec(0, 0),
      width,
      height,
      z: -10,
    });
    background.graphics.use(
      new ex.Rectangle({ width, height, color: ex.Color.fromHex('#0b1220') }),
    );
    this.add(background);
  }

  /**
   * Bake every painted tile into one canvas, then draw that as a single
   * sprite. Cheaper and simpler than one actor per tile.
   */
  private buildLevelGraphic(): ex.Actor {
    const { width, height } = levelPixelSize(this.level);
    const tile = this.level.tileSize;
    const sheet = this.assets.images.tiles.data;
    const sheetColumns = SHEETS.tiles.columns;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    ctx.imageSmoothingEnabled = false;

    for (let row = 0; row < this.level.rows; row++) {
      for (let col = 0; col < this.level.columns; col++) {
        const index = this.level.tiles[row]?.[col] ?? -1;
        if (index < 0) continue;
        const sx = (index % sheetColumns) * tile;
        const sy = Math.floor(index / sheetColumns) * tile;
        ctx.drawImage(sheet, sx, sy, tile, tile, col * tile, row * tile, tile, tile);
      }
    }

    const image = ex.ImageSource.fromHtmlCanvasElement(canvas);
    const sprite = new ex.Sprite({ image, sourceView: { x: 0, y: 0, width, height } });
    const actor = new ex.Actor({ pos: ex.vec(0, 0), anchor: ex.vec(0, 0), z: 0 });
    actor.graphics.use(sprite);
    return actor;
  }

  /** Place every king the level defines. */
  private spawnKings(): void {
    for (const enemy of this.level.enemies) {
      if (enemy.type !== 'king') continue;
      const king = new KingActor(this.level, enemy.col, enemy.row, this.assets);
      this.kings.push(king);
      this.add(king);
    }
  }

  /** Does the player's sword overlap this king right now? */
  private swordTouches(king: KingActor): boolean {
    if (!king.isVulnerable) return false;
    const reach = CONFIG.COMBAT.reach;
    const { x, y, facing } = this.player.state;
    const swordLeft = facing > 0 ? x : x - reach;
    const swordRight = facing > 0 ? x + reach : x;
    const swordTop = y - CONFIG.PLAYER.height;
    const swordBottom = y;

    const halfW = CONFIG.ENEMY.width / 2;
    const kLeft = king.state.x - halfW;
    const kRight = king.state.x + halfW;
    const kTop = king.state.y - CONFIG.ENEMY.height;
    const kBottom = king.state.y;

    return swordRight > kLeft && swordLeft < kRight && swordBottom > kTop && swordTop < kBottom;
  }

  /** Does the player's body overlap this king? */
  private touchesKing(king: KingActor): boolean {
    if (king.isDying) return false;
    const { x, y } = this.player.state;
    const pLeft = x - CONFIG.PLAYER.width / 2;
    const pRight = x + CONFIG.PLAYER.width / 2;
    const pTop = y - CONFIG.PLAYER.height;
    const pBottom = y;

    const halfW = CONFIG.ENEMY.width / 2;
    const kLeft = king.state.x - halfW;
    const kRight = king.state.x + halfW;
    const kTop = king.state.y - CONFIG.ENEMY.height;
    const kBottom = king.state.y;

    return pRight > kLeft && pLeft < kRight && pBottom > kTop && pTop < kBottom;
  }

  private resolveSwordHits(): void {
    for (const king of this.kings) {
      if (this.swordTouches(king)) {
        king.hitBySword();
      }
    }
  }

  /** Touching a live king sends the player back to the spawn point. */
  private checkKingCollisions(): void {
    for (const king of this.kings) {
      if (this.touchesKing(king)) {
        this.player.respawn();
        this.setMessage('The King got you!');
        return;
      }
    }
  }

  /** The 4-frame slash effect, thrown out in front of the player. */
  private spawnSwoosh(x: number, y: number, facing: 1 | -1): void {
    const actor = new ex.Actor({
      pos: ex.vec(x + facing * 10, y - CONFIG.PLAYER.height * 0.6),
      anchor: ex.vec(0.5, 0.5),
      z: 11,
    });
    this.assets.swooshFrames.reset();
    this.assets.swooshFrames.play();
    actor.graphics.use(this.assets.swooshFrames);
    actor.graphics.flipHorizontal = facing < 0;
    this.add(actor);
    this.effects.push({ actor, ttl: CONFIG.COMBAT.attackMs + 40 });
  }

  override onPostUpdate(_engine: ex.Engine, delta: number): void {
    for (const effect of this.effects) {
      effect.ttl -= delta;
      if (effect.ttl <= 0) effect.actor.kill();
    }
    this.effects = this.effects.filter((effect) => !effect.actor.isKilled());

    // Fell into a pit.
    const worldHeight = this.level.rows * this.level.tileSize;
    if (this.player.state.y > worldHeight + 32) {
      this.player.respawn();
      this.won = false;
      this.setMessage('Back to the start!');
    }

    this.checkKingCollisions();
    this.checkGoal();
  }

  private restart(): void {
    this.player.respawn();
    for (const king of this.kings) king.kill();
    this.kings = [];
    this.spawnKings();
    this.won = false;
    this.setMessage('');
  }

  private checkGoal(): void {
    if (this.won) return;
    const tile = this.level.tileSize;
    const half = CONFIG.PLAYER.width / 2;
    const left = this.player.state.x - half;
    const right = this.player.state.x + half;
    const top = this.player.state.y - CONFIG.PLAYER.height;
    const bottom = this.player.state.y;

    const goalLeft = this.level.goal.col * tile;
    const goalRight = goalLeft + tile;
    const goalTop = this.level.goal.row * tile;
    const goalBottom = goalTop + tile;

    const hit = right > goalLeft && left < goalRight && bottom > goalTop && top < goalBottom;
    if (hit) {
      this.won = true;
      this.setMessage('You found the chest! (R to restart)');
    }
  }

  private setMessage(text: string): void {
    const el = document.getElementById('hud-message');
    if (el) el.textContent = text;
  }
}
