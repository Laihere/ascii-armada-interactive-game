import { CONFIG } from "./config.js";
import { Renderer, Starfield } from "./render.js";
import { Input } from "./input.js";
import { Game } from "./game.js";
import { Leaderboard } from "./leaderboard.js";

const $ = (id) => document.getElementById(id);

const canvas = $("screen");
const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
document.body.classList.toggle("touch", isTouch);

// Grid size: the usual 60x34 on wide screens; on an upright phone use fewer, bigger
// columns and as many rows as fit, so the game fills the screen.
function pickGrid() {
  const { cols, rows, portraitCols, maxRows } = CONFIG.grid;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h < w * 1.15) return { cols, rows };
  const cellW = w / portraitCols;
  const fitRows = Math.floor(h / (cellW / 0.6));
  return { cols: portraitCols, rows: Math.max(rows, Math.min(maxRows, fitRows)) };
}

let grid = pickGrid();
const renderer = new Renderer(canvas, grid.cols, grid.rows);
let stars = new Starfield(grid.cols, grid.rows);
const input = new Input();
const board = new Leaderboard(CONFIG.leaderboard);
input.attachPointer($("stage"), canvas);

function applyGrid() {
  const next = pickGrid();
  if (next.cols === grid.cols && next.rows === grid.rows) return;
  grid = next;
  renderer.setGrid(grid.cols, grid.rows);
  stars = new Starfield(grid.cols, grid.rows);
}

// Menus follow rotation; a running game keeps its grid (the canvas just rescales).
window.addEventListener("resize", () => {
  if (!game) applyGrid();
});

const panels = { home: $("home"), board: $("board"), gameover: $("gameover"), pause: $("pause") };
let state = "home";
let game = null;
let lastResult = null;

function show(next) {
  state = next;
  for (const [name, el] of Object.entries(panels)) el.classList.toggle("hidden", name !== next);
  $("btn-pause").classList.toggle("hidden", next !== "game");
  input.active = next === "game" || next === "pause";
  input.reset();
  if (next === "home") $("btn-new").focus();
  if (next === "pause") $("btn-resume").focus();
}

// Debug/practice: ?wave=8 starts at a later wave
function startWaveFromUrl() {
  const n = parseInt(new URLSearchParams(location.search).get("wave"), 10);
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : 1;
}

function startGame() {
  applyGrid();
  game = new Game({ ...CONFIG, grid }, input, {
    onGameOver: gameOver,
    startWave: startWaveFromUrl(),
    touch: isTouch,
  });
  show("game");
}

function gameOver(result) {
  lastResult = result;
  game = null;
  $("go-score").textContent = result.score;
  $("go-wave").textContent = result.wave;
  const top = board.load()[0];
  $("go-note").textContent = !board.qualifies(result.score) ? "Not quite top " + CONFIG.leaderboard.size + " this time."
    : !top || result.score > top.score ? "NEW HIGH SCORE!" : "You made the leaderboard!";
  $("name-error").textContent = "";
  $("name-input").value = board.lastName();
  show("gameover");
  $("name-input").focus();
  $("name-input").select();
}

function showBoard(highlightId = null, message = "") {
  const rows = board.load();
  const body = $("board-rows");
  body.replaceChildren();
  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    if (r.id && r.id === highlightId) tr.className = "me";
    for (const v of [i + 1, r.name, r.score, r.wave ?? "-"]) {
      const td = document.createElement("td");
      td.textContent = String(v); // never innerHTML: names are user input
      tr.appendChild(td);
    }
    body.appendChild(tr);
  });
  $("board-empty").classList.toggle("hidden", rows.length > 0);
  $("board-msg").textContent = message;
  $("board-msg").classList.toggle("hidden", !message);
  show("board");
  $("btn-board-back").focus();
}

function saveScore(e) {
  e.preventDefault();
  if (!lastResult) return;
  const raw = $("name-input").value;
  const err = board.validate(raw);
  if (err) {
    $("name-error").textContent = err;
    $("name-input").focus();
    return;
  }
  const { rank, id } = board.add(raw, lastResult.score, lastResult.wave);
  lastResult = null;
  showBoard(id, rank ? `${raw.trim()} placed #${rank}!` : `${raw.trim()}: not in the top ${CONFIG.leaderboard.size} this time.`);
}

function togglePause() {
  if (!game || (state !== "game" && state !== "pause")) return;
  show(game.togglePause() ? "pause" : "game");
}

function quitToMenu() {
  game = null;
  show("home");
}

input.onPause = togglePause;
$("btn-new").addEventListener("click", startGame);
$("btn-board").addEventListener("click", () => showBoard());
$("btn-board-back").addEventListener("click", () => show("home"));
$("btn-board-play").addEventListener("click", startGame);
$("btn-pause").addEventListener("click", togglePause);
$("btn-resume").addEventListener("click", togglePause);
$("btn-quit").addEventListener("click", quitToMenu);
$("name-form").addEventListener("submit", saveScore);
$("btn-skip").addEventListener("click", () => {
  lastResult = null;
  quitToMenu();
});
$("btn-board-clear").addEventListener("click", () => {
  if (confirm("Clear all scores on this browser?")) {
    board.clear();
    showBoard();
  }
});

// Pause automatically when the tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "game") togglePause();
});

// Main loop: starfield always runs; the game draws on top when active.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const playing = state === "game" && game;
  stars.update(dt, playing ? 1.6 : state === "pause" ? 0 : 0.6);
  if (playing) game.update(dt);

  renderer.clear();
  stars.draw(renderer);
  if (game && (state === "game" || state === "pause")) game.draw(renderer);
  renderer.flush();
  requestAnimationFrame(frame);
}

show("home");
requestAnimationFrame(frame);
