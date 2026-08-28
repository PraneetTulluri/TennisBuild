# Player Rating Methodology

The 8 attribute ratings (`forehand`, `backhand`, `serve`, `return`, `volley`,
`movement`, `power`, `mentalToughness`) in `players.data.js` are **gameplay
approximations informed by well-established, widely-known career reputation
and playing style** — not literal statistical measurements pulled from match
data. This is intentional (see the Phase 0 design doc's balancing notes):
the goal is a roster that _feels_ realistic and produces meaningful
tradeoffs when drafted, not a sports-analytics dataset.

## Scale calibration (1-99, with rare exceptions above 99)

- **~65-70**: an average tour-level professional in that category
- **~85-90**: a genuine strength / weapon for that player
- **~90-97**: a career-defining elite skill, among the best of their era
- **~98-99**: an all-time-best-ever-at-that-skill case
- **100-110**: a legend's (or, rarely, a truly elite active player's)
  single signature skill, pushed past the normal ceiling because even a
  "perfect 99" undersells it - Nadal's mental toughness, Djokovic's
  return, and Sampras's serve sit at the very top of this range (108-109)
  as close to consensus "greatest ever at that specific skill" as tennis
  debates get; Federer's forehand, McEnroe's volley, Agassi's return, and
  a dozen-plus more legend signatures (Becker's serve, Edberg's volley,
  Wawrinka's backhand, del Potro's power, and others) fill out the rest
  of the range, scaled by how singularly iconic that specific skill
  actually was. A couple of today's most complete active stars (Alcaraz's
  movement, Sinner's backhand) cross into this range too - deliberately
  rare among _current_ players so it still reads as "this player is
  genuinely on a legend's level at this one thing," not a second ceiling
  everyone eventually hits. Most players, including most legends, still
  cap at 99.
- **Below 60**: a real, known weakness relative to tour average - reserved
  for players whose game genuinely has that gap. Where the gap is a
  famous, defining part of how that player is remembered (Isner/Karlovic's
  movement, Sampras's return, Ivanisevic's return, Paire's/Kyrgios's
  mental toughness), it's pushed further, into the 35-50 range - the
  point is that landing on a lopsided player should be a real, felt
  tradeoff, not just a slightly-lower number (this is what keeps the
  roster from clustering near the top of the scale; see Phase 0's
  balancing notes on why variance matters)

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

37 current-tour entries were later added from a user-supplied scouting
sheet (a strengths/weaknesses table covering the ATP's top 75 active
players by rough current form) rather than from memory alone - each
entry's 8 attributes were still hand-drafted against this same scale, using
the sheet's "main strengths" column to set the ~80-90 range attributes and
its "rough weaknesses" column to set the below-65 ones, so the two sourcing
approaches stay consistent with each other.
