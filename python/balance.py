"""Print how enemies scale wave by wave, using the same config.json as the web game.

Examples:
    python3 python/balance.py                 # waves 1-20, player with no upgrades
    python3 python/balance.py --waves 40 --upgrades 6
    python3 python/balance.py --csv > balance.csv

Workflow for tuning the game:
    1. edit config.json
    2. python3 python/balance.py            (check the numbers look fair)
    3. python3 python/build_config.py       (writes js/config.js for the browser)

wave_stats() mirrors waveStats() in js/game.js. If you change one, change the other.
"""

import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_config() -> dict:
    return json.loads((ROOT / "config.json").read_text(encoding="utf-8"))


def js_round(x: float) -> int:
    """JavaScript's Math.round (halves round up; Python's round() rounds halves to even)."""
    return math.floor(x + 0.5)


def wave_stats(cfg: dict, wave: int, upgrade_level: int = 0) -> dict:
    w = cfg["waves"]
    n = wave - 1
    count = min(w["maxEnemies"], js_round(w["baseEnemies"] + w["enemiesPerWave"] * n))
    has_elites = wave >= w["eliteFromWave"]
    elite_share = (
        min(w["maxEliteShare"], w["eliteShare"] * (wave - w["eliteFromWave"] + 1)) if has_elites else 0
    )
    elites = min(count, max(1 if has_elites else 0, js_round(count * elite_share)))
    if wave >= w["diveFromWave"]:
        dive_every = max(w["minDiveEvery"], w["diveEvery"] - 0.2 * (wave - w["diveFromWave"]))
    else:
        dive_every = math.inf
    return {
        "count": count,
        "elites": elites,
        "hpMul": 1 + w["hpGrowth"] * n + w["powerFactor"] * upgrade_level,
        "fireMul": 1 + w["fireGrowth"] * n,
        "bulletMul": min(w["maxBulletSpeedFactor"], 1 + w["bulletSpeedGrowth"] * n),
        "diveEvery": dive_every,
        "aimed": wave >= w["aimedFromWave"],
    }


def table_rows(cfg: dict, waves: int, upgrades: int) -> list[dict]:
    normal, elite = cfg["enemy"]["normal"], cfg["enemy"]["elite"]
    rows = []
    for wave in range(1, waves + 1):
        s = wave_stats(cfg, wave, upgrades)
        normals = s["count"] - s["elites"]
        rows.append(
            {
                "wave": wave,
                "enemies": s["count"],
                "elites": s["elites"],
                "normal_hp": max(1, js_round(normal["hp"] * s["hpMul"])),
                "elite_hp": max(1, js_round(elite["hp"] * s["hpMul"])),
                # average shots per second from the whole formation (elites fire 3 bullets)
                "shots_per_s": round(
                    (normals * normal["fireChance"] + s["elites"] * elite["fireChance"] * 3) * s["fireMul"], 1
                ),
                "bullet_speed": round(normal["bulletSpeed"] * s["bulletMul"], 1),
                "dive_every_s": "-" if s["diveEvery"] == math.inf else round(s["diveEvery"], 1),
                "aimed": "yes" if s["aimed"] else "-",
                "wave_points": (normals * normal["score"] + s["elites"] * elite["score"]) * wave,
            }
        )
    return rows


def print_table(rows: list[dict]) -> None:
    headers = list(rows[0].keys())
    widths = [max(len(h), *(len(str(r[h])) for r in rows)) for h in headers]
    print("  ".join(h.rjust(w) for h, w in zip(headers, widths)))
    print("  ".join("-" * w for w in widths))
    for r in rows:
        print("  ".join(str(r[h]).rjust(w) for h, w in zip(headers, widths)))


def main() -> None:
    parser = argparse.ArgumentParser(description="Show enemy scaling per wave.")
    parser.add_argument("--waves", type=int, default=20, help="how many waves to show (default 20)")
    parser.add_argument(
        "--upgrades",
        type=int,
        default=0,
        help="player upgrade level = (power - 1) + rapid; enemies get tougher as this rises (default 0)",
    )
    parser.add_argument("--csv", action="store_true", help="print CSV instead of a table")
    args = parser.parse_args()

    cfg = load_config()
    rows = table_rows(cfg, max(1, args.waves), max(0, args.upgrades))
    if args.csv:
        print(",".join(rows[0].keys()))
        for r in rows:
            print(",".join(str(v) for v in r.values()))
        return

    total = sum(r["wave_points"] for r in rows)
    print(f"ASCII ARMADA balance  (upgrade level {args.upgrades})\n")
    print_table(rows)
    print(f"\nScore for clearing waves 1-{len(rows)}: {total:,} (plus bonus drops)")


if __name__ == "__main__":
    main()
