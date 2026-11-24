# ASCII ARMADA

An endless arcade space shooter drawn entirely in ASCII characters, playable in the browser.
Your ship fires by itself. Dodge, collect upgrades and see how many waves you can survive.

```
   \o/   /-\   \o/        /=O=\
    v    \v/    v         |###|
                           \V/
            !        @
                 |
                 A
                /#\
                ' '
```

## Play

- **Online:** `https://<your-github-username>.github.io/<repo-name>/` (see [Publish on GitHub Pages](#publish-on-github-pages))
- **Locally:** see [Run locally](#run-locally)

### Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys or W A S D, or drag anywhere with a finger / mouse (the ship follows your finger's movement) |
| Shoot | Automatic |
| Pause | P, Esc, or the `II` button |

On a phone held upright the play area becomes taller and narrower to fill the screen.

### Rules

- You have **3 HP** (♥♥♥). After a hit you blink and can't be hit again for a moment.
- Your shots glow **cyan**. Enemy shots glow **red** (`!`, aimed `o`), elite shots glow **gold** (`@`).
- **Normal enemies** (`\o/` `/-\`) shoot straight down.
- **Elite enemies** (`/=O=\`) arrive from wave 3. They have more HP and fire 3-way spreads.
- From wave 4, enemies **dive** at you. From wave 5, some shots are **aimed** at you.
- Waves never end. Every wave brings more enemies with more HP that shoot faster. Enemies also get a little tougher as **you** upgrade.
- **Score:** normal kill = 10 × wave, elite kill = 50 × wave.

### Upgrades (dropped by destroyed enemies; elites drop more often)

| Drop | Effect |
| --- | --- |
| `[P]` Power | +1 shot stream (up to 5). You lose one level when you lose a heart |
| `[R]` Rapid | Fire faster (up to 4) |
| `[S]` Shield | Blocks the next hit |
| `[+]` Repair | +1 HP (max 3) |
| `[$]` Bonus | Extra points (dropped once everything is maxed) |

### Leaderboard

At game over, enter a pilot name: 3–12 characters, letters, numbers and `_` only. The top 10 scores are
saved **in your browser** (localStorage), so each device/browser has its own board.

### Practice mode

Add `?wave=N` to the address to start at wave N with matching upgrades, e.g. `index.html?wave=10`.

## Run locally

The game uses JavaScript modules, which browsers won't load from a `file://` path, so serve the folder:

```bash
cd ascii-shooter
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish on GitHub Pages

1. Create a new repository on GitHub and push this folder to it (branch `main`).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Choose branch **`main`** and folder **`/ (root)`**, then **Save**.
4. After a minute the game is live at `https://<your-github-username>.github.io/<repo-name>/`.

No build step is needed. The `.nojekyll` file tells Pages to serve the files as they are.

## Python tools

All game balance numbers live in **`config.json`**. The browser reads them from `js/config.js`, which is
generated from `config.json` by Python, so the web game and the Python tools always share the same numbers.

```bash
# 1. See how enemies scale wave by wave
python3 python/balance.py                       # waves 1-20, no upgrades
python3 python/balance.py --waves 40 --upgrades 6
python3 python/balance.py --csv > balance.csv   # open in a spreadsheet / make a chart

# 2. After editing config.json, rebuild the browser config
python3 python/build_config.py
```

Example `balance.py` output:

```
wave  enemies  elites  normal_hp  elite_hp  shots_per_s  bullet_speed  dive_every_s  aimed  wave_points
   1        8       0          2         9          2.0          14.0             -      -           80
   5       14       3          3        13         10.8          16.2           3.3    yes         1300
  10       22       9          4        19         33.5          19.0           2.3    yes         5800
```

Things to try in `config.json`: `player.maxHp`, `player.speed`, `waves.hpGrowth`, `waves.eliteFromWave`,
`drops.weights`. Check the table, rebuild, then reload the page.

`wave_stats()` in `python/balance.py` uses the same formula as `waveStats()` in `js/game.js`. If you change one, change the other.

No packages to install: the tools use only the Python standard library (Python 3.9+).

## Project layout

```
index.html            screens: home, leaderboard, pause, game over
css/style.css         terminal look
js/main.js            screen switching, buttons, main loop
js/game.js            game rules: player, enemies, waves, scaling, collisions, HUD
js/entities.js        ASCII sprites, colours, shot patterns, effects
js/render.js          draws a 60x34 character grid onto a <canvas>; starfield
js/input.js           keyboard + drag controls
js/leaderboard.js     top-10 scores in localStorage
js/config.js          GENERATED from config.json (don't edit by hand)
config.json           all balance numbers
python/build_config.py  config.json -> js/config.js
python/balance.py       wave-by-wave scaling table
```
