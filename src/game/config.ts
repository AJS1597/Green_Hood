/** All gameplay tunables live here. */
export const CONFIG = {
  VIEW: {
    width: 960,
    height: 540,
  },
  WORLD: {
    width: 2400,
    groundY: 470,
  },
  PLAYER: {
    width: 28,
    height: 44,
    moveSpeed: 260,
    jumpSpeed: 620,
    gravity: 1800,
  },
  ARROW: {
    speed: 780,
    cooldownMs: 320,
    width: 22,
    height: 4,
  },
  TARGET: {
    width: 44,
    height: 80,
    points: 10,
  },
} as const;
