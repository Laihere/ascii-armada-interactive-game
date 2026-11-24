// Character-grid renderer: the game draws chars into a cols x rows buffer,
// then flush() paints the buffer onto a <canvas> in a monospace font.

const FONT_STACK = '"Cascadia Mono", "Consolas", "DejaVu Sans Mono", "Menlo", monospace';
const CHAR_ASPECT = 0.6; // monospace glyph width / height

export class Renderer {
  constructor(canvas, cols, rows) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cols = cols;
    this.rows = rows;
    this.chars = new Array(cols * rows).fill(" ");
    this.colors = new Array(cols * rows).fill("#fff");
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const availW = window.innerWidth - 8;
    const availH = window.innerHeight - 8;
    // cell height limited by both axes
    const cellH = Math.max(8, Math.floor(Math.min(availH / this.rows, availW / (this.cols * CHAR_ASPECT))));
    this.cellH = cellH;
    this.cellW = cellH * CHAR_ASPECT;
    const w = Math.round(this.cellW * this.cols);
    const h = cellH * this.rows;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.font = `${Math.floor(cellH * 0.92)}px ${FONT_STACK}`;
    this.ctx.textBaseline = "top";
    this.ctx.textAlign = "center";
  }

  clear() {
    this.chars.fill(" ");
  }

  put(x, y, ch, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.chars[i] = ch;
    this.colors[i] = color;
  }

  // Draw a string; spaces are transparent (they don't overwrite).
  text(x, y, str, color) {
    for (let i = 0; i < str.length; i++) {
      if (str[i] !== " ") this.put(x + i, y, str[i], color);
    }
  }

  centerText(y, str, color) {
    this.text(Math.floor((this.cols - str.length) / 2), y, str, color);
  }

  // Draw a multi-line sprite with its top-left at (x, y).
  sprite(x, y, lines, color) {
    for (let r = 0; r < lines.length; r++) this.text(x, y + r, lines[r], color);
  }

  flush() {
    const { ctx, cols, rows, cellW, cellH } = this;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, cols * cellW, rows * cellH);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const ch = this.chars[i];
        if (ch === " ") continue;
        ctx.fillStyle = this.colors[i];
        ctx.fillText(ch, x * cellW + cellW / 2, y * cellH + 1);
      }
    }
  }
}

// Scrolling starfield shared by menus and gameplay.
export class Starfield {
  constructor(cols, rows, count = 70) {
    this.cols = cols;
    this.rows = rows;
    this.stars = Array.from({ length: count }, () => this.spawn(Math.random() * rows));
  }

  spawn(y) {
    const layer = Math.random();
    return {
      x: Math.floor(Math.random() * this.cols),
      y,
      speed: 2 + layer * 10,
      ch: layer > 0.8 ? "*" : layer > 0.45 ? "+" : ".",
      color: layer > 0.8 ? "#d8e6ff" : layer > 0.45 ? "#6f86a8" : "#34445c",
    };
  }

  update(dt, speedMul = 1) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.y += s.speed * dt * speedMul;
      if (s.y >= this.rows) this.stars[i] = this.spawn(0);
    }
  }

  draw(r) {
    for (const s of this.stars) r.put(s.x, s.y, s.ch, s.color);
  }
}
