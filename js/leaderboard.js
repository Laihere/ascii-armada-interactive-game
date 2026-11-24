// Local leaderboard stored in this browser (localStorage). Top N by score.

const KEY = "asciiArmada.scores";
const NAME_KEY = "asciiArmada.lastName";

export class Leaderboard {
  constructor(cfg) {
    this.size = cfg.size;
    this.nameMin = cfg.nameMin;
    this.nameMax = cfg.nameMax;
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(data)) return [];
      // keep only well-formed rows (storage can be edited by hand)
      return data
        .filter((r) => r && typeof r.name === "string" && Number.isFinite(r.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, this.size);
    } catch {
      return [];
    }
  }

  // Returns an error message, or "" when the name is fine.
  validate(raw) {
    const name = raw.trim();
    if (name.length < this.nameMin) return `At least ${this.nameMin} characters.`;
    if (name.length > this.nameMax) return `At most ${this.nameMax} characters.`;
    if (!/^[A-Za-z0-9_]+$/.test(name)) return "Letters, numbers and _ only.";
    return "";
  }

  qualifies(score) {
    const rows = this.load();
    return score > 0 && (rows.length < this.size || score > rows[rows.length - 1].score);
  }

  // Adds the score; returns { rank (1-based, or 0 if it didn't make the board), id }.
  add(rawName, score, wave) {
    const name = rawName.trim();
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const rows = this.load();
    rows.push({ id, name, score, wave, date: new Date().toISOString().slice(0, 10) });
    rows.sort((a, b) => b.score - a.score);
    const kept = rows.slice(0, this.size);
    try {
      localStorage.setItem(KEY, JSON.stringify(kept));
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* storage full or blocked: board just won't persist */
    }
    const idx = kept.findIndex((r) => r.id === id);
    return { rank: idx + 1, id };
  }

  lastName() {
    try {
      return localStorage.getItem(NAME_KEY) || "";
    } catch {
      return "";
    }
  }

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
