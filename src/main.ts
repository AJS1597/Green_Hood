import * as ex from 'excalibur';
import { CONFIG } from './game/config';
import { loadAssets, type GameAssets } from './game/assets';
import { type Level, createEmptyLevel } from './game/level';
import { loadLevel } from './game/levelFile';
import { GameScene } from './game/GameScene';

/**
 * Entry point. Appending `/dev` to the URL opens the level editor instead of
 * the game (see src/editor/editor.ts).
 */

function isEditorRoute(): boolean {
  return /\/dev\/?$/.test(location.pathname) || location.hash === '#dev';
}

async function loadGameData(): Promise<{ assets: GameAssets; level: Level }> {
  const assets = await loadAssets();
  let level: Level;
  try {
    level = await loadLevel();
  } catch (error) {
    console.warn('Falling back to an empty level:', error);
    level = createEmptyLevel(40, 22);
  }
  return { assets, level };
}

async function startGame(): Promise<void> {
  const { assets, level } = await loadGameData();

  const game = new ex.Engine({
    width: CONFIG.VIEW.width,
    height: CONFIG.VIEW.height,
    canvasElementId: 'game',
    displayMode: ex.DisplayMode.FitScreen,
    backgroundColor: ex.Color.fromHex('#0b1220'),
    pixelArt: true,
    physics: false,
    suppressPlayButton: true,
  });

  const scene = new GameScene(level, assets);
  game.add('game', scene);
  await game.start();
  void game.goToScene('game');

  // Handy console handle, mirroring the reference project.
  (window as unknown as { __hood?: unknown }).__hood = { game, scene };
}

if (isEditorRoute()) {
  void import('./editor/editor').then((editor) => editor.startEditor());
} else {
  void startGame();
}
