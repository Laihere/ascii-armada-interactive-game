import {
  ASPECT, COLORS, PLAYER, ENEMY_TYPES, POWERUPS, SHOT_PATTERNS,
  bulletChar, pointInRect, rectsOverlap, explosion, floatText,
} from "./entities.js";

const STEP = 1 / 120; // fixed physics step so fast bullets never skip a sprite

// Enemy scaling for a wave. python/balance.py mirrors this formula; keep them in sync.
export function waveStats(cfg, wave, upgradeLevel = 0) {
  const w = cfg.waves;
  const n = wave - 1;
  const count = Math.min(w.maxEnemies, Math.round(w.baseEnemies + w.enemiesPerWave * n));
  const eliteShare = wave >= w.eliteFromWave
    ? Math.min(w.maxEliteShare, w.eliteShare * (wave - w.eliteFromWave + 1))
    : 0;
  const elites = Math.max(wave >= w.eliteFromWave ? 1 : 0, Math.round(count * eliteShare));
  return {
    count,
    elites: Math.min(elites, count),
    hpMul: 1 + w.hpGrowth * n + w.powerFactor * upgradeLevel,
    fireMul: 1 + w.fireGrowth * n,
    bulletMul: Math.min(w.maxBulletSpeedFactor, 1 + w.bulletSpeedGrowth * n),
    diveEvery: wave >= w.diveFromWave
      ? Math.max(w.minDiveEvery, w.diveEvery - 0.2 * (wave - w.diveFromWave))
      : Infinity,
    aimed: wave >= w.aimedFromWave,
  };
}

export class Game {
  constructor(cfg, input, { onGameOver, startWave = 1 } = {}) {
    this.cfg = cfg;
    this.input = input;
    this.onGameOver = onGameOver;
    this.cols = cfg.grid.cols;
    this.rows = cfg.grid.rows;
    this.startWave = startWave;
    this.reset();
  }

  reset() {
    const p = this.cfg.player;
    this.player = {
      x: (this.cols - PLAYER.w) / 2, y: this.rows - 5, w: PLAYER.w, h: PLAYER.h,
      hp: p.maxHp, power: 1, rapid: 0, shield: false, invuln: 0, cooldown: 0.5, alive: true,
    };
    this.bullets = [];       // player shots
    this.enemyBullets = [];
    this.enemies = [];
    this.drops = [];
    this.particles = [];
    this.score = 0;
    this.kills = 0;
    this.wave = this.startWave - 1;
    this.time = 0;
    this.acc = 0;
    this.paused = false;
    this.over = false;
    this.overTimer = 0;
    this.diveTimer = 0;
    // practice start (?wave=N): give upgrades a normal run would have by then
    if (this.startWave > 1) {
      this.player.power = Math.min(this.cfg.player.maxPower, 1 + Math.floor(this.startWave / 3));
      this.player.rapid = Math.min(this.maxRapid, Math.floor(this.startWave / 4));
    }
    this.shake = 0;
    this.nextWave();
  }

  get upgradeLevel() {
    return this.player.power - 1 + this.player.rapid;
  }

  get maxRapid() {
    const p = this.cfg.player;
    return Math.floor((p.fireInterval - p.minFireInterval) / p.rapidStep + 1e-9);
  }

  nextWave() {
    this.wave += 1;
    this.stats = waveStats(this.cfg, this.wave, this.upgradeLevel);
    this.banner = this.cfg.waves.bannerTime;
    this.bannerSub = this.wave === this.cfg.waves.eliteFromWave ? "! ELITES INCOMING !"
      : this.wave === this.cfg.waves.diveFromWave ? "! DIVERS INCOMING !"
      : this.wave % 5 === 0 ? "! THEY GROW STRONGER !" : "";
    this.pendingSpawn = true;
    this.diveTimer = this.stats.diveEvery;
  }

  spawnWave() {
    const { count, elites, hpMul } = this.stats;
    const e = this.cfg.enemy;
    const perRow = 8;
    const kinds = [];
    for (let i = 0; i < count; i++) {
      kinds.push(i < elites ? "elite" : (i % 2 ? "wing" : "drone"));
    }
    let i = 0;
    let rowY = 3;
    while (i < kinds.length) {
      const row = kinds.slice(i, i + perRow);
      const rowH = row.some((k) => k === "elite") ? 4 : 3;
      const rowW = (row.length - 1) * 6 + 5;
      const left = Math.floor((this.cols - rowW) / 2);
      row.forEach((kind, j) => {
        const t = ENEMY_TYPES[kind];
        const base = t.elite ? e.elite.hp : e.normal.hp;
        const hp = Math.max(1, Math.round(base * hpMul));
        const slotX = left + j * 6 + (t.w === 3 ? 1 : 0);
        this.enemies.push({
          kind, ...t, hp, maxHp: hp,
          slotX, slotY: rowY,
          x: slotX, y: -4 - (i + j) * 0.6,
          state: "enter", flash: 0,
          fireCd: 1 + Math.random() * 2,
        });
      });
      i += row.length;
      rowY += rowH;
    }
  }

  togglePause() {
    if (this.over) return false;
    this.paused = !this.paused;
    this.input.reset();
    return this.paused;
  }

  update(dt) {
    if (this.paused) return;
    this.acc += dt;
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
  }

  step(h) {
    this.time += h;
    this.updateParticles(h);

    if (this.over) {
      this.updateBullets(h);
      this.overTimer -= h;
      if (this.overTimer <= 0 && this.onGameOver) {
        const cb = this.onGameOver;
        this.onGameOver = null; // fire once
        cb({ score: this.score, wave: this.wave, kills: this.kills });
      }
      return;
    }

    if (this.banner > 0) {
      this.banner -= h;
      if (this.banner <= 0 && this.pendingSpawn) {
        this.pendingSpawn = false;
        this.spawnWave();
      }
    }

    this.updatePlayer(h);
    this.updateEnemies(h);
    this.updateBullets(h);
    this.updateDrops(h);
    this.collide();

    if (!this.pendingSpawn && this.enemies.length === 0) this.nextWave();
  }

  // ---------- player ----------
  updatePlayer(h) {
    const pl = this.player;
    const cfg = this.cfg.player;
    const { x, y } = this.input.axis();
    const len = Math.hypot(x, y) || 1;
    pl.x += (x / len) * cfg.speed * h;
    pl.y += (y / len) * cfg.speed * ASPECT * h;
    // touch: glide toward the finger target
    const t = this.input.touchTarget;
    if (t) {
      const tx = t.x * this.cols - pl.w / 2;
      const ty = t.y * this.rows - 3;
      const max = cfg.speed * 1.4 * h;
      pl.x += Math.max(-max, Math.min(max, tx - pl.x));
      pl.y += Math.max(-max * ASPECT, Math.min(max * ASPECT, ty - pl.y));
    }
    pl.x = Math.max(0, Math.min(this.cols - pl.w, pl.x));
    pl.y = Math.max(2, Math.min(this.rows - pl.h - 2, pl.y));
    if (pl.invuln > 0) pl.invuln -= h;

    pl.cooldown -= h;
    if (pl.cooldown <= 0) {
      pl.cooldown = Math.max(cfg.minFireInterval, cfg.fireInterval - cfg.rapidStep * pl.rapid);
      for (const [ox, vx] of SHOT_PATTERNS[pl.power - 1]) {
        this.bullets.push({ x: pl.x + ox, y: pl.y - 1, vx, vy: -cfg.bulletSpeed, dmg: 1 });
      }
    }
  }

  damagePlayer() {
    const pl = this.player;
    if (pl.invuln > 0 || !pl.alive) return;
    const cx = pl.x + 1;
    const cy = pl.y + 1;
    if (pl.shield) {
      pl.shield = false;
      pl.invuln = 1;
      floatText(this.particles, cx - 3, cy - 2, "SHIELD!", COLORS.shield);
      return;
    }
    pl.hp -= 1;
    pl.power = Math.max(1, pl.power - 1);
    pl.invuln = this.cfg.player.invulnTime;
    explosion(this.particles, cx, cy, false);
    this.shake = 0.3;
    if (pl.hp <= 0) {
      pl.alive = false;
      explosion(this.particles, cx, cy, true);
      explosion(this.particles, cx, cy, true);
      this.over = true;
      this.overTimer = 1.8;
    }
  }

  // ---------- enemies ----------
  updateEnemies(h) {
    const sway = Math.sin(this.time * 0.9) * 4;
    const bob = Math.sin(this.time * 1.7) * 0.6;
    const pl = this.player;

    // pick a diver now and then
    if (this.stats.diveEvery !== Infinity && this.banner <= 0) {
      this.diveTimer -= h;
      if (this.diveTimer <= 0) {
        this.diveTimer = this.stats.diveEvery * (0.7 + Math.random() * 0.6);
        const pool = this.enemies.filter((e) => e.state === "formation" && !e.elite);
        if (pool.length) {
          const d = pool[(Math.random() * pool.length) | 0];
          d.state = "dive";
          d.vx = 0;
        }
      }
    }

    for (const e of this.enemies) {
      if (e.flash > 0) e.flash -= h;
      const tx = e.slotX + sway;
      const ty = e.slotY + bob;
      if (e.state === "enter") {
        const speed = 22;
        const dx = tx - e.x;
        const dy = ty - e.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.5) e.state = "formation";
        else {
          e.x += (dx / d) * speed * h;
          e.y += (dy / d) * speed * ASPECT * h * 1.4;
        }
      } else if (e.state === "formation") {
        e.x = tx;
        e.y = ty;
      } else if (e.state === "dive") {
        const ds = this.cfg.waves.diveSpeed * (1 + 0.03 * this.wave);
        const want = (pl.x - e.x) * 1.2;
        e.vx += Math.max(-30, Math.min(30, want - e.vx)) * h * 2;
        e.x += e.vx * h;
        e.y += ds * h;
        if (e.y > this.rows) {
          e.y = -3;
          e.state = "enter";
        }
      }

      // firing
      if (e.state !== "enter" && e.y >= 1 && pl.alive) {
        e.fireCd -= h;
        if (e.fireCd <= 0) {
          const base = e.elite ? this.cfg.enemy.elite : this.cfg.enemy.normal;
          const rate = base.fireChance * this.stats.fireMul;
          e.fireCd = (0.5 + Math.random()) / rate;
          this.enemyFire(e, base.bulletSpeed * this.stats.bulletMul);
        }
      }
    }
  }

  enemyFire(e, speed) {
    const bx = e.x + Math.floor(e.w / 2);
    const by = e.y + e.h;
    const pl = this.player;
    const aim = () => {
      const dx = (pl.x + 1 - bx) * ASPECT;
      const dy = Math.max(2, pl.y - by);
      const n = Math.hypot(dx, dy);
      return [(speed * dx) / n / ASPECT, (speed * dy) / n];
    };
    if (e.elite) {
      if (this.stats.aimed && Math.random() < 0.5) {
        const [vx, vy] = aim();
        for (const off of [-4, 0, 4]) this.enemyBullets.push({ x: bx, y: by, vx: vx + off, vy, ch: "@", color: COLORS.eliteBullet, glow: COLORS.eliteGlow });
      } else {
        for (const vx of [-7, 0, 7]) this.enemyBullets.push({ x: bx, y: by, vx, vy: speed, ch: "@", color: COLORS.eliteBullet, glow: COLORS.eliteGlow });
      }
    } else if (this.stats.aimed && Math.random() < 0.35) {
      const [vx, vy] = aim();
      this.enemyBullets.push({ x: bx, y: by, vx, vy, ch: "o", color: COLORS.enemyBullet, glow: COLORS.enemyGlow });
    } else {
      this.enemyBullets.push({ x: bx, y: by, vx: 0, vy: speed, ch: "!", color: COLORS.enemyBullet, glow: COLORS.enemyGlow });
    }
  }

  killEnemy(e) {
    const base = e.elite ? this.cfg.enemy.elite.score : this.cfg.enemy.normal.score;
    const pts = base * this.wave;
    this.score += pts;
    this.kills += 1;
    explosion(this.particles, e.x + e.w / 2, e.y + e.h / 2, e.elite);
    floatText(this.particles, e.x, e.y, "+" + pts, e.elite ? COLORS.accent : "#cfd8e3");
    const d = this.cfg.drops;
    if (Math.random() < (e.elite ? d.eliteChance : d.normalChance)) {
      this.drops.push({ x: e.x + Math.floor(e.w / 2) - 1, y: e.y, type: this.rollDrop() });
    }
  }

  rollDrop() {
    const pl = this.player;
    const weights = { ...this.cfg.drops.weights };
    // don't drop things the player can't use
    if (pl.power >= this.cfg.player.maxPower) weights.P = 0;
    if (pl.rapid >= this.maxRapid) weights.R = 0;
    if (pl.shield) weights.S = 0;
    if (pl.hp >= this.cfg.player.maxHp) weights["+"] = 0;
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total === 0) return "BONUS";
    let r = Math.random() * total;
    for (const [k, w] of Object.entries(weights)) {
      r -= w;
      if (r < 0) return k;
    }
    return "P";
  }

  // ---------- bullets, drops, particles ----------
  updateBullets(h) {
    const move = (list) => {
      for (const b of list) {
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      return list.filter((b) => b.y > -1 && b.y < this.rows && b.x > -1 && b.x < this.cols);
    };
    this.bullets = move(this.bullets);
    this.enemyBullets = move(this.enemyBullets);
  }

  updateDrops(h) {
    const fall = this.cfg.drops.fallSpeed;
    for (const d of this.drops) d.y += fall * h;
    this.drops = this.drops.filter((d) => d.y < this.rows);
  }

  updateParticles(h) {
    for (const p of this.particles) {
      p.x += p.vx * h;
      p.y += p.vy * h;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= h;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.shake > 0) this.shake -= h;
  }

  collect(type) {
    const pl = this.player;
    const cfg = this.cfg.player;
    const label = type === "BONUS" ? "BONUS" : POWERUPS[type].name;
    if (type === "P") pl.power = Math.min(cfg.maxPower, pl.power + 1);
    else if (type === "R") pl.rapid = Math.min(this.maxRapid, pl.rapid + 1);
    else if (type === "S") pl.shield = true;
    else if (type === "+") pl.hp = Math.min(cfg.maxHp, pl.hp + 1);
    else this.score += 100 * this.wave;
    floatText(this.particles, pl.x - 1, pl.y - 2, label + "!", type === "BONUS" ? COLORS.accent : POWERUPS[type].color);
  }

  // ---------- collisions ----------
  collide() {
    const pl = this.player;

    // player shots vs enemies
    for (const b of this.bullets) {
      const bx = Math.round(b.x);
      const by = Math.round(b.y);
      for (const e of this.enemies) {
        if (e.hp > 0 && pointInRect(bx, by, Math.round(e.x), Math.round(e.y), e.w, e.h)) {
          e.hp -= b.dmg;
          e.flash = 0.08;
          b.dead = true;
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    if (!pl.alive) {
      this.enemies = this.enemies.filter((e) => e.hp > 0);
      return;
    }

    // enemy shots vs player: forgiving hitbox (nose + body row)
    const px = Math.round(pl.x);
    const py = Math.round(pl.y);
    for (const b of this.enemyBullets) {
      const bx = Math.round(b.x);
      const by = Math.round(b.y);
      if ((by === py && bx === px + 1) || (by === py + 1 && bx >= px && bx <= px + 2)) {
        b.dead = true;
        this.damagePlayer();
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);

    // ramming
    for (const e of this.enemies) {
      if (e.hp > 0 && rectsOverlap(pl, e)) {
        this.damagePlayer();
        if (!e.elite) {
          e.hp = 0;
          this.killEnemy(e);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // pick-ups (slightly larger grab box)
    const grab = { x: pl.x - 1, y: pl.y - 1, w: pl.w + 2, h: pl.h + 2 };
    for (const d of this.drops) {
      if (rectsOverlap(grab, { x: d.x, y: d.y, w: 3, h: 1 })) {
        d.taken = true;
        this.collect(d.type);
      }
    }
    this.drops = this.drops.filter((d) => !d.taken);
  }

  // ---------- drawing ----------
  draw(r) {
    const pl = this.player;
    const sx = this.shake > 0 ? Math.round((Math.random() - 0.5) * 2) : 0;

    for (const d of this.drops) {
      const pu = POWERUPS[d.type] || { label: "[$]", color: COLORS.accent };
      const blink = Math.floor(this.time * 6) % 2 === 0;
      r.text(d.x + sx, d.y, pu.label, blink ? pu.color : "#ffffff");
    }

    for (const e of this.enemies) {
      r.sprite(e.x + sx, e.y, e.sprite, e.flash > 0 ? COLORS.hit : e.color);
      if (e.elite && e.hp < e.maxHp) {
        const filled = Math.ceil((e.hp / e.maxHp) * e.w);
        r.text(e.x + sx, e.y - 1, "=".repeat(filled), COLORS.danger);
      }
    }

    for (const b of this.bullets) {
      r.put(b.x + sx - b.vx * 0.03, b.y + 1, ":", COLORS.bulletTrail); // short trail
    }
    for (const b of this.bullets) {
      r.put(b.x + sx, b.y, bulletChar(b.vx, b.vy), COLORS.bullet, { bg: COLORS.bulletGlow, bold: true });
    }
    for (const b of this.enemyBullets) r.put(b.x + sx, b.y, b.ch, b.color, { bg: b.glow, bold: true });

    if (pl.alive && !(pl.invuln > 0 && Math.floor(pl.invuln * 12) % 2 === 0)) {
      r.sprite(pl.x + sx, pl.y, PLAYER.sprite, COLORS.player);
      const f = Math.floor(this.time * 14) % 2;
      r.text(pl.x + sx, pl.y + 2, PLAYER.flames[f], COLORS.flame[f]);
      if (pl.shield) {
        r.put(pl.x - 1 + sx, pl.y, "(", COLORS.shield);
        r.put(pl.x - 1 + sx, pl.y + 1, "(", COLORS.shield);
        r.put(pl.x + 3 + sx, pl.y, ")", COLORS.shield);
        r.put(pl.x + 3 + sx, pl.y + 1, ")", COLORS.shield);
      }
    }

    for (const p of this.particles) {
      if (p.text) r.text(p.x, p.y, p.text, p.color);
      else r.put(p.x, p.y, p.ch, p.color);
    }

    this.drawHud(r);

    if (this.banner > 0 && !this.over) {
      r.centerText(14, `-=  WAVE ${this.wave}  =-`, COLORS.accent);
      if (this.bannerSub) r.centerText(16, this.bannerSub, COLORS.danger);
    }
    if (this.over) r.centerText(15, "* SHIP DESTROYED *", COLORS.danger);
  }

  drawHud(r) {
    const pl = this.player;
    const cfg = this.cfg.player;
    r.text(1, 0, "SCORE " + String(this.score).padStart(7, "0"), COLORS.hud);
    const waveTxt = "WAVE " + this.wave;
    r.text(Math.floor((this.cols - waveTxt.length) / 2), 0, waveTxt, COLORS.accent);
    const hearts = "♥".repeat(Math.max(0, pl.hp)) + "·".repeat(Math.max(0, cfg.maxHp - pl.hp));
    r.text(this.cols - 1 - hearts.length - 3, 0, "HP " + hearts, COLORS.danger);

    const y = this.rows - 1;
    const bar = (n, max) => "#".repeat(n) + "-".repeat(max - n);
    r.text(1, y, "PWR", COLORS.hudDim);
    r.text(5, y, bar(pl.power, cfg.maxPower), POWERUPS.P.color);
    r.text(12, y, "RPD", COLORS.hudDim);
    r.text(16, y, bar(pl.rapid, this.maxRapid), POWERUPS.R.color);
    if (pl.shield) r.text(23, y, "SHIELD", COLORS.shield);
    r.text(this.cols - 16, y, "P/Esc = pause", COLORS.hudDim);
  }
}
