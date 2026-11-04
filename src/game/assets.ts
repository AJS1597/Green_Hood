import * as ex from 'excalibur';
import {
  AssetPaths,
  GOAL_TILE,
  LADDER_TILES,
  PLAYER_FRAMES,
  PLAYER_ROW,
  SHEETS,
  SOLID_TILE_HINTS,
  TILE_COUNT,
} from './tileset';

// Re-export the plain asset facts so existing `./assets` imports keep working.
export {
  AssetPaths,
  GOAL_TILE,
  LADDER_TILES,
  PLAYER_FRAMES,
  PLAYER_ROW,
  SHEETS,
  SOLID_TILE_HINTS,
  TILE_COUNT,
};

/**
 * ============================================================================
 *  ASSET LOADING
 * ============================================================================
 *
 * The plain facts about each file (paths, grid sizes, special tile indexes)
 * live in `tileset.ts`; this module loads them with Excalibur.
 *
 * Runtime files (in `public/assets/`):
 *   characters.png  the player, a 4-row spritesheet (the green character is row 2)
 *   sheet.png       the 16x16 tilesheet used to build levels
 *   swoosh.png      the 4-frame sword-slash effect
 *   music.ogg       looping background music ("Dark Rooms and Scary Things")
 *   sfx-sword.wav   sword swing sound (from the "Swishes" pack, swish-7)
 *   sfx-jump.wav    jump sound (from the "Swishes" pack, swish-4)
 */

export interface PlayerAnimations {
  idle: ex.Animation;
  run: ex.Animation;
  jump: ex.Animation;
  fall: ex.Animation;
  climb: ex.Animation;
  attack: ex.Animation;
}

export interface GameSounds {
  music: ex.Sound;
  sword: ex.Sound;
  jump: ex.Sound;
}

export interface GameAssets {
  /** Raw source images, needed for canvas rendering and the editor. */
  images: {
    characters: ex.ImageSource;
    tiles: ex.ImageSource;
    swoosh: ex.ImageSource;
  };
  characters: ex.SpriteSheet;
  tiles: ex.SpriteSheet;
  swoosh: ex.SpriteSheet;
  swooshFrames: ex.Animation;
  sounds: GameSounds;
  animations: PlayerAnimations;
}

/** Load an image with crisp (nearest-neighbour) scaling for pixel art. */
export async function loadImage(path: string): Promise<ex.ImageSource> {
  const source = new ex.ImageSource(path, { filtering: ex.ImageFiltering.Pixel });
  await source.load();
  return source;
}

/** Slice a loaded image into a grid of sprites. */
export function slice(
  image: ex.ImageSource,
  grid: (typeof SHEETS)[keyof typeof SHEETS],
): ex.SpriteSheet {
  return ex.SpriteSheet.fromImageSource({ image, grid: { ...grid } });
}

/** One sprite from a sheet: `col` left-to-right, `row` top-to-bottom. */
export function sprite(sheet: ex.SpriteSheet, col: number, row: number): ex.Sprite {
  return sheet.getSprite(col, row);
}

/** Build the player's named animations from the characters sheet. */
export function createPlayerAnimations(sheet: ex.SpriteSheet): PlayerAnimations {
  const frame = (col: number) => ({ graphic: sprite(sheet, col, PLAYER_ROW) });
  const frames = (cols: readonly number[]) => cols.map(frame);

  return {
    idle: new ex.Animation({ frames: [frame(PLAYER_FRAMES.idle)], frameDuration: 200 }),
    run: new ex.Animation({
      frames: frames(PLAYER_FRAMES.run),
      frameDuration: 100,
      strategy: ex.AnimationStrategy.Loop,
    }),
    jump: new ex.Animation({ frames: [frame(PLAYER_FRAMES.jump)], frameDuration: 200 }),
    fall: new ex.Animation({ frames: [frame(PLAYER_FRAMES.fall)], frameDuration: 200 }),
    climb: new ex.Animation({
      frames: frames(PLAYER_FRAMES.climb),
      frameDuration: 130,
      strategy: ex.AnimationStrategy.Loop,
    }),
    attack: new ex.Animation({
      frames: frames(PLAYER_FRAMES.attack),
      frameDuration: 70,
      strategy: ex.AnimationStrategy.Freeze,
    }),
  };
}

/** Build the four-frame slash effect from the swoosh sheet. */
export function createSwooshAnimation(sheet: ex.SpriteSheet): ex.Animation {
  const frames = [0, 1, 2, 3].map((col) => ({ graphic: sprite(sheet, col, 0) }));
  return new ex.Animation({
    frames,
    frameDuration: 60,
    strategy: ex.AnimationStrategy.Freeze,
  });
}

/** Load every image and sound the game needs. */
export async function loadAssets(): Promise<GameAssets> {
  const [charactersImage, tilesImage, swooshImage] = await Promise.all([
    loadImage(AssetPaths.characters),
    loadImage(AssetPaths.tiles),
    loadImage(AssetPaths.swoosh),
  ]);

  const characters = slice(charactersImage, SHEETS.characters);
  const tiles = slice(tilesImage, SHEETS.tiles);
  const swoosh = slice(swooshImage, SHEETS.swoosh);

  const music = new ex.Sound(AssetPaths.music);
  music.loop = true;
  music.volume = 0.5;

  const sword = new ex.Sound(AssetPaths.sfxSword);
  sword.volume = 0.8;
  const jump = new ex.Sound(AssetPaths.sfxJump);
  jump.volume = 0.8;

  return {
    images: { characters: charactersImage, tiles: tilesImage, swoosh: swooshImage },
    characters,
    tiles,
    swoosh,
    swooshFrames: createSwooshAnimation(swoosh),
    sounds: { music, sword, jump },
    animations: createPlayerAnimations(characters),
  };
}
