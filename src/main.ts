import * as ex from 'excalibur';
import { CONFIG } from './game/config';
import { GameScene } from './game/GameScene';

const game = new ex.Engine({
  width: CONFIG.VIEW.width,
  height: CONFIG.VIEW.height,
  canvasElementId: 'game',
  displayMode: ex.DisplayMode.FitScreen,
  backgroundColor: ex.Color.fromHex('#0a150d'),
});

const scene = new GameScene();
game.add('game', scene);
game.start().then(() => {
  game.goToScene('game');
});

game.input.keyboard.on('press', (evt) => {
  if (evt.key === ex.Keys.R) {
    scene.resetRoom();
  }
});

// Expose the scene for quick console debugging, mirroring the reference project.
(window as unknown as { __hood?: unknown }).__hood = { game, scene };
