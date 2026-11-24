import { CONFIG } from "./config.js";
import { Renderer, Starfield } from "./render.js";
import { Input } from "./input.js";

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($("screen"), CONFIG.grid.cols, CONFIG.grid.rows);
const stars = new Starfield(CONFIG.grid.cols, CONFIG.grid.rows);
const input = new Input();

const panels = { home: $("home"), board: $("board"), gameover: $("gameover") };
let state = "home";

function show(next) {
  state = next;
  for (const [name, el] of Object.entries(panels)) el.classList.toggle("hidden", name !== next);
  input.active = next === "game";
  input.reset();
  if (next === "home") $("btn-new").focus();
}

function startGame() {
  show("game");
}

input.onPause = () => show("home"); // placeholder until the game loop exists

$("btn-new").addEventListener("click", startGame);
$("btn-board").addEventListener("click", () => show("board"));
$("btn-board-back").addEventListener("click", () => show("home"));

// Main loop: starfield always runs; the game draws on top when active.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  stars.update(dt, state === "game" ? 1.6 : 0.6);
  renderer.clear();
  stars.draw(renderer);
  if (state === "game") {
    renderer.centerText(16, "GAME LOOP GOES HERE (TIER 2)", "#ffcc4d");
    renderer.centerText(18, "press Esc to go back", "#3f7a4c");
  }
  renderer.flush();
  requestAnimationFrame(frame);
}

show("home");
requestAnimationFrame(frame);
