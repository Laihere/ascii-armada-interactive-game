// Keyboard state: arrows + WASD for movement, P / Esc for pause.

const KEYMAP = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
};

export class Input {
  constructor() {
    this.held = { left: false, right: false, up: false, down: false };
    this.onPause = null;
    this.active = false; // only swallow keys while the game screen is up

    window.addEventListener("keydown", (e) => {
      if (!this.active) return;
      const dir = KEYMAP[e.code];
      if (dir) {
        this.held[dir] = true;
        e.preventDefault();
      } else if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat && this.onPause) {
        this.onPause();
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      const dir = KEYMAP[e.code];
      if (dir) this.held[dir] = false;
    });
    window.addEventListener("blur", () => this.reset());
  }

  reset() {
    for (const k in this.held) this.held[k] = false;
  }

  // -1..1 on each axis
  axis() {
    return {
      x: (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0),
      y: (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0),
    };
  }
}
