/** Every tunable number for the platformer lives here. */
export const CONFIG = {
  /** Logical resolution of the game canvas (scaled to fit the window). */
  VIEW: { width: 960, height: 540 },

  /** Tiles are 16x16 in the source sheet. */
  TILE: 16,

  /** The camera zooms in so 16px tiles read clearly on screen. */
  CAMERA: { zoom: 2 },

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
  },

  AUDIO: {
    musicVolume: 0.5,
    sfxVolume: 0.8,
  },
} as const;
