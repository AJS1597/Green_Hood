import * as ex from 'excalibur';

/**
 * ============================================================================
 *  AUDIO
 * ============================================================================
 *
 * Browsers start the WebAudio context suspended and only let it run after a
 * real user gesture. Excalibur's own unlock normally happens from its play
 * button, but this game starts straight away, so we unlock from the first
 * keydown/pointerdown ourselves (see `startAudio`).
 *
 * `playSound` waits for that unlock, so sounds triggered on the very first
 * input still play instead of being dropped.
 */

let unlocked: Promise<void> | null = null;

/**
 * Resume the audio context. Must be called from a real user-gesture handler
 * (e.g. `window.addEventListener('keydown', ...)`).
 */
export function unlockAudio(): Promise<void> {
  if (!unlocked) {
    unlocked = ex.WebAudio.unlock()
      .then(() => undefined)
      .catch(() => undefined);
  }
  return unlocked;
}

/** True once unlock has been requested. */
export function isAudioUnlocked(): boolean {
  return unlocked !== null;
}

/** Play a sound, waiting for the audio context to be unlocked first. */
export function playSound(sound: ex.Sound): void {
  const ready = unlocked ?? Promise.resolve();
  void ready.then(() => {
    void sound.play();
  });
}

/**
 * Wire up one-shot listeners that unlock audio on the first user gesture and
 * run `onReady` (used to start the music loop).
 */
export function startAudioOnFirstGesture(onReady?: () => void): void {
  const start = () => {
    void unlockAudio().then(() => onReady?.());
  };
  window.addEventListener('keydown', start, { once: true });
  window.addEventListener('pointerdown', start, { once: true });
  window.addEventListener('touchstart', start, { once: true });
}
