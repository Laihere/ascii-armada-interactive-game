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
    this.dragX = 0; // pending drag movement (fraction of canvas size)
    this.dragY = 0;

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

  // Drag anywhere on `surface` (finger or mouse) to steer. Movement is relative:
  // the ship moves by however far the finger moves, measured against the canvas size.
  attachPointer(surface, canvas) {
    let last = null;
    surface.addEventListener("pointerdown", (e) => {
      if (!this.active || e.target.closest("button, input, a")) return;
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
      surface.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    surface.addEventListener("pointermove", (e) => {
      if (!last || e.pointerId !== last.id) return;
      if (!this.active) {
        last = null;
        return;
      }
      const r = canvas.getBoundingClientRect();
      this.dragX += (e.clientX - last.x) / r.width;
      this.dragY += (e.clientY - last.y) / r.height;
      last.x = e.clientX;
      last.y = e.clientY;
      e.preventDefault();
    });
    const end = (e) => {
      if (last && e.pointerId === last.id) last = null;
    };
    surface.addEventListener("pointerup", end);
    surface.addEventListener("pointercancel", end);
  }

  // Drag distance since last call, as a fraction of the canvas size.
  consumeDrag() {
    const d = { x: this.dragX, y: this.dragY };
    this.dragX = 0;
    this.dragY = 0;
    return d;
  }

  reset() {
    this.dragX = 0;
    this.dragY = 0;
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
