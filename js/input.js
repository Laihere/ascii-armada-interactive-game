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
    this.touchTarget = null; // {x, y} in 0..1 of the canvas while dragging

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

  // Drag on the canvas (finger or mouse) to steer: the ship glides toward the pointer.
  attachPointer(canvas) {
    const update = (e) => {
      const r = canvas.getBoundingClientRect();
      this.touchTarget = {
        x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      };
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.active) return;
      canvas.setPointerCapture(e.pointerId);
      update(e);
      e.preventDefault();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.active && this.touchTarget) update(e);
    });
    const end = () => { this.touchTarget = null; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  reset() {
    this.touchTarget = null;
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
