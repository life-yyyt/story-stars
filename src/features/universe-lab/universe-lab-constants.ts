export const UNIVERSE_LAB_CAMERA = {
  minDistance: 118,
  hardMaxDistance: 1220,
  initialMinDistance: 240,
  initialMaxDistance: 660,
  farPlane: 2800,
  readerApproachScale: 0.9,
} as const;

export const UNIVERSE_LAB_STARFIELD = {
  farRevealStart: 480,
  farRevealEnd: 1080,
  farSizeBoost: 0.78,
  farAlphaBoost: 0.22,
  farLuminanceBoost: 0.08,
  farMinPointSize: 2.15,
  farCoreFloor: 0.18,
} as const;
