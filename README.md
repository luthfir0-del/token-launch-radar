# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/luthfir0-del/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/luthfir0-del/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: 200 pre-token DeFi protocols ranked by implied value — TVL × seven-day growth × age with no token — with a six-step farm plan for each one. Tokens that already trade sit apart, at market value.

## The model (radar-2)

```
implied_value_usd = TVL × 0.30 × growthMult × maturityMult
growthMult   = 1 + clamp(change_7d, -50%, +150%) / 100 × 0.9
maturityMult = 0.55 + min(age_days, 1460) / 1460 × 0.45   (age unknown: 180 days)
```

The board covers all 40 protocols on the snapshot's watchlist (TVL ≥ $50M, no token recorded) plus the 160 largest pre-token protocols below the floor. No protocol name is ever special-cased: the same function scores every row, and the dashboard recomputes every row from the same figures so the page and the board always agree.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Requires Node.js 22.18 or later. `main.ts` reads the sealed snapshot, writes `board.json` (the ranked board), `data.js` (the dashboard's data), copies `dashboard/` and `screenshots/` into the output directory, and writes `dossier.json` with the vendored make.fun library. The run is deterministic: two runs over the same snapshot write byte-identical outputs.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
