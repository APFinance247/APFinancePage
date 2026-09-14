# Risk methodology

What the 1-10 score means, how it is built, and what it cannot tell you.

## The one-sentence version

The risk score measures how stretched a price is against its own moving-average
structure — not whether the company is good, and not whether the stock is
cheap on earnings.

A high score means price has run far above the averages it usually reverts to.
A low score means it is sitting at or below levels that historically marked
accumulation. That is the whole claim.

## How the score is built

Computed in `scripts/snapshot.mjs`, a port of `calculateEMAFocusedRisk` in
`scripts/generate-all-stock-csvs.js`. Same inputs, same output — a snapshot run
with `--source=csv` reproduces the published CSV's risk column exactly.

Indicators, all on daily bars with week-scaled periods:

- 8-week EMA (40 sessions) and 21-week EMA (105 sessions)
- 50/100/200/400-week SMAs (250 / 500 / 1000 / 2000 sessions)

Then, in order:

1. **Base score from the 8-week EMA.** Price 15%+ above it lands in "yellow
   territory" (8.0-9.5, scaled by how far above). Between 8% and 15% above
   interpolates 6.5-8.0. Within -5% to +8% interpolates 5.0-6.5. Below that the
   21-week EMA takes over for 3-5, and below *that* the deepest deviation across
   the 50/100/200-week SMAs sets 1-3.
2. **Recency tilt.** Data from the last ~3.5 years gets lows nudged down 0.2 and
   highs up 0.1, so recent extremes read slightly sharper.
3. **Volatility discount.** 20-session realised vol above 4% daily shaves 0.1;
   above 6% shaves 0.2. A violent tape is treated as less "safely elevated".
4. **Trend alignment.** When price sits on the same side of the 8W EMA, 21W EMA
   and 50W SMA, the score moves ±0.15 with the trend.
5. **Bounds and smoothing.** Clamped to 1-10, then blended 80/20 with the prior
   point's seed value.

### Per-symbol thresholds

The 15% / 8% / -5% cutoffs are the default. Volatile names get wider bands so a
normal week doesn't register as extreme; index funds get tighter ones:

| Symbol | Yellow | Elevated | Near EMA |
| --- | --- | --- | --- |
| VOO | 10% | 5% | -3% |
| TSLA, GRAL | 20% | 10% | -8% |
| META | 18% | 10% | -8% |
| BTC, ETH | 25% | 15% | -10% |
| everything else | 15% | 8% | -5% |

A ticker with no entry uses the defaults. That is fine for most large caps and
wrong for anything that routinely moves 10% in a week — say so in the report
when it applies, and read the score as directionally useful rather than precise.

## Reading a score

| Score | Label | Reading |
| --- | --- | --- |
| 1-2 | Very Low | Extreme undervaluation vs. its own structure — historically rare |
| 2-3 | Low | Below key support — value territory |
| 3-4 | Low-Moderate | Below historical average — reasonable entry |
| 4-6 | Moderate | Fair-value range |
| 6-7 | Moderate-High | Above historical average — elevated |
| 7-8.5 | High | Top quartile of its own history — caution |
| 8.5-9 | Very High | Top decile |
| 9-10 | Extreme | Top 5% of historical deviation |

Always pair the absolute score with `risk.percentileOfOwnHistory` and
`risk.distributionPct`. A 6.5 on a ticker that spends 40% of its life above 6 is
unremarkable; the same 6.5 on one that has been there 5% of the time is the
story.

## Base rates (`bandHistory`)

For every past session where the score sat in the current integer band, the
snapshot measures the forward return 21, 63, 126 and 252 sessions later, and
reports median, average, win rate, worst and best, with a sample count.

This is a base rate over one ticker's own history. It is:

- **not** a forecast, and not a probability of anything happening next;
- heavily overlapping — consecutive sessions share most of their forward window,
  so the effective sample is far smaller than `samples` suggests;
- survivorship-shaped — it only covers a company that made it to today;
- dominated by the regime it lived through. A mega-cap's 12-month base rate
  measured across a secular bull market says more about the market than the name.

Quote the median with the sample count and the worst case. Never quote the
average alone — one 1226% outlier drags it anywhere.

## The score saturates at both ends

The 1-3 branch assigns a flat 1.0 to anything whose deepest deviation across the
50/100/200-week SMAs is 25% or worse, and the yellow branch assigns a flat 9.5
above twice the yellow threshold. Neither has any resolution beyond that point.

In practice this means a broad selloff pins dozens of names at exactly 1.00, and
they are not equally dislocated — one is 26% below its 200-week SMA and another
is 60% below. A screen sorted by score alone cannot tell them apart, which is
why `screen.mjs` breaks ties on distance from the 50-week SMA.

When a report cites a floored score, cite the underlying deviation next to it.
"Risk 1.0, 39% below its 50-week SMA" is information; "Risk 1.0" alone is a
clipped reading.

## What this score cannot tell you

- **Whether the company is any good.** No revenue, margin, cash flow or
  balance-sheet input touches the score.
- **Whether it's cheap.** A stock at risk 2 can be expensive at 40x earnings
  while falling; a stock at risk 8 can be cheap at 15x while compounding.
  Valuation comes from Step 2 of the skill, not from here.
- **Anything about a catalyst.** Earnings, product cycles, litigation and
  regulation are invisible to it.
- **Much of anything on a young ticker.** Under ~4 years of history there is no
  200-week SMA and the low-risk branch has nothing to anchor on.

The score's job in the report is to say *how stretched the price is right now*.
Everything else in the report is there because the score can't answer it.

## Data notes

- Source is the free Yahoo Finance chart endpoint — split- and
  dividend-adjusted closes, no API key.
- Live Yahoo history and the committed CSVs can differ by a few basis points on
  the longer SMAs (adjustment revisions, different start dates). The risk score
  is stable to ~0.01 between them.
- `snapshot.mjs` uses explicit `period1`/`period2` bounds. Don't switch it to
  `range=max`; Yahoo silently downgrades that to monthly bars, which produces a
  confidently wrong score.
