---
name: stock-analysis
description: Find and research stocks. Screens a whole universe — the S&P 500, Nasdaq, or every US-traded common stock — by the APFinance risk model (1-10) to surface candidates, then researches any single ticker end-to-end in about five minutes with fundamentals, valuation, catalysts and news, producing a written report with an explicit verdict. Use whenever someone asks to analyze, research, value, or get a read on a ticker ("analyze NVDA", "is AMD expensive right now", "what's the risk on Bitcoin"), asks for a risk score, an entry point, or a comparison — or asks what to buy, what looks cheap, what's oversold, or wants a watchlist, a scan, or a screen across the market.
---

# Stock analysis

Produce a research report on a ticker that leads with a number the reader can
act on — the risk score — and backs it with the fundamentals and news that
explain it.

The quantitative half is deterministic and runs locally. The qualitative half
is web research. Do both; a report with only one half is not the deliverable.

**Which step to start at.** If the user named a ticker, start at Step 1. If they
asked an open question — what's cheap, what's oversold, what should I be looking
at — start at Step 0 to build the candidate list, then run Steps 1-3 on the two
or three names worth the depth. Never run a full report on twenty screen rows.

## Step 0 — Screen for candidates (only when no ticker was named)

```bash
node .claude/skills/stock-analysis/scripts/screen.mjs --max-risk=3.5 --limit=20
```

Scores an entire universe with the same risk model and ranks it. The full S&P
500 takes about 20 seconds.

| Flag | Default | Notes |
| --- | --- | --- |
| `--universe=` | `sp500` | `sp500` (~500) · `nasdaq` (~3000 Nasdaq-listed) · `all` (~4800 US common stocks) · `tracked` (the site's own CSVs) · `file:PATH` · `AMD,SNDK,NVDA` |
| `--sort=` | `risk-asc` | `risk-desc` (most extended) · `percentile-asc/desc` (rare *for that ticker*) · `drawdown` · `momentum` |
| `--max-risk=` `--min-risk=` | — | Score filters |
| `--min-dollar-volume=` | `5000000` | 30-session average. Raise to 20M+ on `nasdaq`/`all` or the list fills with microcaps |
| `--limit=` | `25` | Rows printed |
| `--json` | off | Machine-readable, for further filtering |

Universe lists come from Wikipedia (S&P 500) and the Nasdaq symbol directory,
cached for a day under `.cache/`. Both are free and keyless.

Reading the output:

- **`risk-asc` alone is a blunt instrument.** The score floors at exactly 1.00,
  and in a drawdown dozens of names tie there. Ties break on distance below the
  50-week SMA, so the top rows are the most dislocated — but a 1.00 means "as
  low as this model goes", not "the best opportunity".
- **`percentile-asc` is the sharper screen — except at the floor.** It asks how
  unusual today's score is *for that ticker*, surfacing a quality name at an
  unusual discount rather than whatever fell hardest. But a floored score is
  always the ticker's own minimum, so every 1.00 name also shows 0% and the two
  sorts collapse into each other. Pair it with `--min-risk=1.5` to see past them.
- **A low score is a question, not an answer.** Half of any deep-value screen is
  broken businesses that deserve to be down. Step 2 is what separates them.

Then pick candidates and run the full workflow on each. Say why you picked them.

## Step 1 — Run the risk snapshot

```bash
node .claude/skills/stock-analysis/scripts/snapshot.mjs --symbol=NVDA --pretty
```

Works on any Yahoo-listed ticker, not just the twelve in `public/stock-data/`.
Crypto uses the bare symbol (`BTC`, `ETH`) — the script maps it to `-USD`.

The script fetches full daily history from Yahoo Finance, computes the 8/21-week
EMAs and 50/100/200/400-week SMAs, scores risk 1-10 with the same algorithm the
site publishes, and returns JSON:

| Field | What it gives you |
| --- | --- |
| `risk.score`, `risk.level` | The headline: where price sits versus its own moving-average structure |
| `risk.percentileOfOwnHistory` | How rare today's score is for *this* ticker |
| `risk.distributionPct` | How much of its life the ticker spent in each band |
| `movingAverages.*.devPct` | % above/below each EMA and SMA — the raw inputs to the score |
| `levels` | 52-week and all-time-high context, drawdown |
| `returns`, `volatility` | Trailing performance and annualised vol |
| `bandHistory.sessions` | **Base rates**: median/average forward return and win rate 1, 3, 6 and 12 months out from every past day this ticker sat in the current band |

`bandHistory` is the most quotable part of the report — use it, and always cite
the sample count alongside the median.

Flags: `--source=csv` reads `public/stock-data/<SYM>.csv` instead of the network
(only for covered tickers, and only as fresh as the last daily commit);
`--source=yahoo` forces the network. Default `auto` tries Yahoo, falls back to CSV.

If the script errors, say so and continue with the qualitative half rather than
inventing numbers.

Read `references/methodology.md` before interpreting a score — especially the
limits section, which says what the score cannot tell you.

## Step 2 — Research the business

Run these searches concurrently; they are independent. Prefer primary sources
(SEC filings, the company's IR page, the earnings release) over aggregators, and
note the date on anything you quote — a stale number stated confidently is the
main failure mode here.

1. **Latest results** — most recent quarter: revenue, growth rate, margins, EPS,
   guidance, and how the print landed versus expectations.
2. **Valuation** — current P/E, forward P/E, P/S, EV/EBITDA, and how each
   compares to the ticker's own 5-year range and to its closest peers. The risk
   score is technical, not fundamental; this is where valuation actually enters.
3. **The business** — what it sells, who pays for it, market position, moat,
   customer concentration.
4. **Catalysts and risks** — next earnings date, product cycles, regulatory or
   legal overhangs, competitive threats, insider or institutional activity.
5. **Recent news** — last 1-3 months, and anything that explains a sharp move in
   the `returns` block.

For a comparison request, run Step 1 for each ticker and Step 2 on the
dimensions that actually differ; don't produce two disconnected reports.

## Step 3 — Write the report

Follow `references/report-template.md`. Rules that matter more than the layout:

- **Lead with the verdict.** First paragraph states the risk score, the band's
  historical base rate, and what that combination means. No throat-clearing.
- **Reconcile the halves.** The interesting sentence is usually where the
  technical read and the fundamental read disagree — a low risk score on
  deteriorating fundamentals is a value trap; a high score on accelerating
  fundamentals is momentum. Say which one you think this is.
- **Numbers carry dates and sources.** "Trading 12% above its 50-week SMA (as of
  2026-09-11)" beats "trading well above trend."
- **Give levels, not vibes.** Where does risk drop a band? What price is that?
  The `movingAverages` block has the answer — an EMA value *is* a price level.
- **State what would change your mind.** One or two falsifiable conditions.
- **Close with the disclaimer** from the template. This is research, not advice.

Length: roughly 700-1200 words for a single ticker. Longer is not better.

## Step 4 — Optional outputs

Only when asked:

- **Post-ready summary** — a short caption version for the APFinance feed:
  hook, the risk number, two or three supporting stats, the level to watch.
  Keep the disclaimer.
- **Artifact** — publish the report as a page when the user wants something
  shareable rather than terminal output.
- **Add to the site** — a ticker the user wants tracked ongoing goes in
  `STOCK_CONFIGS`; follow `ADD-NEW-TICKERS-GUIDE.md`, not this skill.

## Guardrails

- Never state or imply a price target, a guaranteed outcome, or a
  buy/sell instruction. Frame everything as risk, base rates and conditions.
- Base rates describe the past. Say so plainly when quoting them — a 75% 12-month
  win rate is not a 75% chance.
- A thin `bandHistory.occurrences` count (under ~100 sessions) makes the base
  rate noise. Report the count and downweight it.
- Recent IPOs and young tickers have no 200/400-week SMA; those `devPct` fields
  come back `null` and the score leans on the shorter averages. Flag the
  shortened history rather than treating the score as equally reliable.
- If the user holds the position or is asking whether to buy, answer the analysis
  question and let them draw the conclusion.
