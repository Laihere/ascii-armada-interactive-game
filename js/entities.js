// Sprites, colours and small entity helpers. Positions are in grid cells (floats);
// the renderer rounds them. (x, y) is always the top-left of the sprite.

export const ASPECT = 0.6; // cell width / cell height, used to keep speeds/angles looking even

export const COLORS = {
  player: "#9dffb0",
  flame: ["#ffb347", "#ff6b3d"],
  shield: "#6fc3ff",
  // bullets: bright bold char on a coloured glow box so they stand out
  bullet: "#ffffff",
  bulletGlow: "rgba(64, 210, 255, 0.55)",
  bulletTrail: "#2aa9d6",
  enemyBullet: "#fff0f2",
  enemyGlow: "rgba(255, 40, 90, 0.75)",
  eliteBullet: "#2b1a00",
  eliteGlow: "rgba(255, 196, 0, 0.95)",
  hit: "#ffffff",
  hud: "#9dffb0",
  hudDim: "#3f7a4c",
  accent: "#ffcc4d",
  danger: "#ff5c5c",
};

export const PLAYER = {
  sprite: [" A ", "/#\\"],
  flames: ["' '", ". ."],
  w: 3,
  h: 2,
};

export const ENEMY_TYPES = {
  drone: { sprite: ["\\o/", " v "], color: "#ff6b6b", w: 3, h: 2, elite: false },
  wing: { sprite: ["/-\\", "\\v/"], color: "#c792ea", w: 3, h: 2, elite: false },
  elite: { sprite: ["/=O=\\", "|###|", " \\V/ "], color: "#ffcc4d", w: 5, h: 3, elite: true },
};

export const POWERUPS = {
  P: { label: "[P]", color: "#5ce1ff", name: "POWER" },
  R: { label: "[R]", color: "#ffe066", name: "RAPID" },
  S: { label: "[S]", color: "#6fc3ff", name: "SHIELD" },
  "+": { label: "[+]", color: "#ff7b9c", name: "REPAIR" },
};

// Player shot patterns per power level: [x offset from sprite left, vx]
export const SHOT_PATTERNS = [
  [[1, 0]],
  [[0, 0], [2, 0]],
  [[1, 0], [0, -9], [2, 9]],
  [[0, 0], [2, 0], [0, -9], [2, 9]],
  [[0, 0], [1, 0], [2, 0], [0, -12], [2, 12]],
];

export function bulletChar(vx, vy) {
  if (Math.abs(vx) < Math.abs(vy) * 0.25) return "|";
  // moving up-left or down-right looks like "\"
  return (vx < 0) === (vy < 0) ? "\\" : "/";
}

// Point (cell) inside a rect?
export function pointInRect(px, py, x, y, w, h) {
  return px >= x && px < x + w && py >= y && py < y + h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function explosion(particles, cx, cy, big = false) {
  const n = big ? 26 : 10;
  const chars = big ? ["*", "#", "+", "x", "."] : ["*", "+", "."];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (big ? 6 : 3) + Math.random() * (big ? 14 : 8);
    particles.push({
      x: cx,
      y: cy,
      vx: (Math.cos(a) * s) / ASPECT,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * (big ? 0.8 : 0.4),
      ch: chars[(Math.random() * chars.length) | 0],
      color: Math.random() < 0.5 ? "#ffcc4d" : "#ff7b3d",
    });
  }
}

export function floatText(particles, x, y, text, color) {
  particles.push({ x, y, vx: 0, vy: -4, life: 0.8, text, color });
}
