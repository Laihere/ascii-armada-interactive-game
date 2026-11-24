import { CONFIG } from "./config.js";
import { Renderer, Starfield } from "./render.js";
import { Input } from "./input.js";
import { Game } from "./game.js";

const $ = (id) => document.getElementById(id);

const canvas = $("screen");
const renderer = new Renderer(canvas, CONFIG.grid.cols, CONFIG.grid.rows);
const stars = new Starfield(CONFIG.grid.cols, CONFIG.grid.rows);
const input = new Input();
input.attachPointer(canvas);

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
  game = new Game(CONFIG, input, { onGameOver: gameOver, startWave: startWaveFromUrl() });
  show("game");
}

function gameOver(result) {
  lastResult = result;
  $("go-score").textContent = result.score;
  $("go-wave").textContent = result.wave;
  show("gameover");
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
$("btn-board").addEventListener("click", () => show("board"));
$("btn-board-back").addEventListener("click", () => show("home"));
$("btn-pause").addEventListener("click", togglePause);
$("btn-resume").addEventListener("click", togglePause);
$("btn-quit").addEventListener("click", quitToMenu);
$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  quitToMenu();
});
$("btn-skip").addEventListener("click", quitToMenu);

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
