/** Every tunable number for the platformer lives here. */
export const CONFIG = {
  /** Logical resolution of the game canvas (scaled to fit the window). */
  VIEW: { width: 960, height: 540 },

  /** Tiles are 16x16 in the source sheet. */
  TILE: 16,

  /** The camera zooms in so 16px tiles read clearly on screen. */
  CAMERA: {
    /** Preferred visible world height in pixels; zoom is derived from this. */
    targetViewHeight: 270,
    minZoom: 2,
    maxZoom: 8,
  },

  PHYSICS: {
    gravity: 1500, // px/s^2
    maxFallSpeed: 900,
    moveSpeed: 170,
    groundAccel: 1400,
    airAccel: 900,
    groundFriction: 1600,
    jumpSpeed: 430,
    /** Releasing jump early cuts upward velocity for variable-height jumps. */
    jumpCutMultiplier: 0.45,
    /** Grace period (ms) after leaving a ledge where a jump still works. */
    coyoteTimeMs: 90,
    /** Jump input is remembered (ms) if pressed just before landing. */
    jumpBufferMs: 120,
    ladderClimbSpeed: 110,
    /** Sideways snap speed while climbing toward the ladder centre. */
    ladderSnapSpeed: 240,
  },

  PLAYER: {
    /** Collision box, anchored at the feet. Smaller than the 32px sprite art. */
    width: 10,
    height: 22,
  },

  COMBAT: {
    /** How long the sword swing (and the swoosh effect) lasts, in ms. */
    attackMs: 260,
    /** Cooldown before another swing is allowed, in ms. */
    attackCooldownMs: 340,
    /** How far in front of the player the sword reaches, in pixels. */
    reach: 24,
  },

  ENEMY: {
    /** Collision box of the king, anchored at the feet. */
    width: 12,
    height: 22,
    /** Patrol speed, in px/s. */
    speed: 42,
    /** Sword hits needed to defeat a king. */
    hp: 3,
    /** How long the red hurt flash lasts after a non-lethal hit, in ms. */
    flashMs: 150,
    /** How long the red death flash lasts before the king is removed, in ms. */
    deathMs: 500,
  },

  AUDIO: {
    musicVolume: 0.5,
    sfxVolume: 0.8,
  },
} as const;
