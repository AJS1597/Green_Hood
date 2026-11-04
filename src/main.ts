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
    displayMode: ex.DisplayMode.Fixed,
    backgroundColor: ex.Color.fromHex('#0b1220'),
    pixelArt: true,
    physics: false,
    suppressPlayButton: true,
  });

  const scene = new GameScene(level, assets);
  game.add('game', scene);
  await game.start();
  void game.goToScene('game');

  fitCanvasToWindow(game);
  setupFullscreen(game);

  // Handy console handle, mirroring the reference project.
  (window as unknown as { __hood?: unknown }).__hood = { game, scene };
}

/**
 * Scale the canvas to the window by a whole-number factor so pixel art stays
 * crisp (no blurry fractional scaling). Leftover space is left as a border.
 */
function fitCanvasToWindow(game: ex.Engine): void {
  const apply = () => {
    const scale = Math.max(
      1,
      Math.floor(
        Math.min(
          window.innerWidth / CONFIG.VIEW.width,
          window.innerHeight / CONFIG.VIEW.height,
        ),
      ),
    );
    game.canvas.style.width = `${CONFIG.VIEW.width * scale}px`;
    game.canvas.style.height = `${CONFIG.VIEW.height * scale}px`;
  };

  apply();
  window.addEventListener('resize', () => {
    apply();
    // Excalibur may re-apply its own canvas size on resize; run again after.
    requestAnimationFrame(apply);
  });
}

/** Toggle real browser fullscreen (button + the F key). */
function setupFullscreen(game: ex.Engine): void {
  const toggle = () => {
    if (game.screen.isFullscreen) {
      void game.screen.exitFullscreen();
    } else {
      void game.screen.enterFullscreen('shell');
    }
  };

  game.input.keyboard.on('press', (event) => {
    if (event.key === ex.Keys.F) toggle();
  });
  document
    .getElementById('fullscreen-button')
    ?.addEventListener('click', (event) => {
      event.preventDefault();
      toggle();
    });
}

if (isEditorRoute()) {
  void import('./editor/editor').then((editor) => editor.startEditor());
} else {
  void startGame();
}
