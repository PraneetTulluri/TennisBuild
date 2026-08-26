# Player Rating Methodology

The 8 attribute ratings (`forehand`, `backhand`, `serve`, `return`, `volley`,
`movement`, `power`, `mentalToughness`) in `players.data.js` are **gameplay
approximations informed by well-established, widely-known career reputation
and playing style** — not literal statistical measurements pulled from match
data. This is intentional (see the Phase 0 design doc's balancing notes):
the goal is a roster that _feels_ realistic and produces meaningful
tradeoffs when drafted, not a sports-analytics dataset.

## Scale calibration (1-99)

- **~65-70**: an average tour-level professional in that category
- **~85-90**: a genuine strength / weapon for that player
- **~90-97**: a career-defining elite skill, among the best of their era
- **~98-99**: reserved for a small handful of all-time-best-ever-at-that-skill
  cases (e.g. Sampras's serve, Djokovic's return)
- **Below 60**: a real, known weakness relative to tour average — reserved
  for players whose game genuinely has that gap (this is what keeps the
  roster from clustering near the top of the scale; see Phase 0's balancing
  notes on why variance matters)

## Per-attribute signal

| Attribute           | What informs the rating                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Serve               | Ace-rate / service-game dominance reputation                                        |
| Return              | Return-game / break-point conversion reputation                                     |
| Forehand / Backhand | Tour consensus on whether the shot is a "weapon," "average," or a known "liability" |
| Volley              | Net-play reputation — serve-and-volleyers and touch players rate highest            |
| Movement            | Athleticism / court-coverage reputation                                             |
| Power               | Groundstroke and serve pace reputation                                              |
| Mental Toughness    | Composite of big-match/clutch record and known consistency (or lack thereof)        |

## Provenance

Ratings were drafted directly from general tennis knowledge (no live
statistical lookups), per an explicit product decision to prioritize speed
and defensible-by-reputation numbers over precise stat-sourcing for the
MVP. If this dataset is expanded later, keep new entries calibrated against
the scale above so the pool stays internally consistent.
