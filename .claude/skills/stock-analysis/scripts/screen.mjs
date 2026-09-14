#!/usr/bin/env node
/**
 * Screen a universe of tickers by risk score.
 *
 * This is the discovery half: it answers "what should I even look at?" so the
 * deep report from snapshot.mjs has a candidate list to work from. Runs the
 * same risk model over every name in an index or the whole market, then ranks.
 *
 * Usage:
 *   node screen.mjs                                   # S&P 500, cheapest first
 *   node screen.mjs --max-risk=3 --limit=20           # deep-value candidates
 *   node screen.mjs --sort=risk-desc --limit=15       # most extended names
 *   node screen.mjs --universe=nasdaq --min-dollar-volume=20000000
 *   node screen.mjs --universe=AMD,SNDK,NVDA --json
 *
 * Flags:
 *   --universe=...           sp500 (default) | nasdaq | all | tracked |
 *                            file:PATH | SYM,SYM,...
 *   --sort=...               risk-asc (default) | risk-desc | percentile-asc |
 *                            percentile-desc | drawdown | momentum
 *   --max-risk=N             keep only scores at or below N
 *   --min-risk=N             keep only scores at or above N
 *   --min-dollar-volume=N    30-session average, default 5000000 (0 disables)
 *   --limit=N                rows to print, default 25
 *   --years=N                history depth per ticker, default 15
 *   --concurrency=N          parallel fetches, default 6
 *   --json                   full JSON instead of a table
 *   --quiet                  suppress progress output
 */

import {
  STOCK_CONFIGS,
  bandOf,
  buildPoints,
  fetchYahoo,
  mapConcurrent,
  avgDollarVolume,
  riskDescription,
  riskPercentile,
  trailingReturn,
  money,
  pct,
} from './lib/risk-engine.mjs';
import { resolveUniverse } from './lib/universe.mjs';

// The score saturates: anything deep enough below its long averages pins at
// exactly 1.00, and a broad selloff can tie dozens of names there. Every sort
// therefore breaks ties on distance from the 50-week SMA — genuinely more
// dislocated first — so a floor-heavy screen still ranks usefully.
const byDislocation = (a, b) => (a.vsSma50wPct ?? 0) - (b.vsSma50wPct ?? 0);

const withTiebreak = (primary) => (a, b) => primary(a, b) || byDislocation(a, b);

const SORTS = {
  'risk-asc': withTiebreak((a, b) => a.risk - b.risk),
  'risk-desc': withTiebreak((a, b) => b.risk - a.risk),
  'percentile-asc': withTiebreak((a, b) => (a.riskPercentilePct ?? 101) - (b.riskPercentilePct ?? 101)),
  'percentile-desc': withTiebreak((a, b) => (b.riskPercentilePct ?? -1) - (a.riskPercentilePct ?? -1)),
  drawdown: withTiebreak((a, b) => (a.fromHigh52wPct ?? 0) - (b.fromHigh52wPct ?? 0)),
  momentum: withTiebreak((a, b) => (b.return1yPct ?? -1e9) - (a.return1yPct ?? -1e9)),
};

function parseArgs(argv) {
  const args = {
    universe: 'sp500',
    sort: 'risk-asc',
    limit: 25,
    years: 15,
    concurrency: 6,
    minDollarVolume: 5_000_000,
    json: false,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--universe=')) args.universe = arg.slice(11);
    else if (arg.startsWith('--sort=')) args.sort = arg.slice(7).toLowerCase();
    else if (arg.startsWith('--max-risk=')) args.maxRisk = Number(arg.slice(11));
    else if (arg.startsWith('--min-risk=')) args.minRisk = Number(arg.slice(11));
    else if (arg.startsWith('--min-dollar-volume=')) args.minDollarVolume = Number(arg.slice(20));
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8));
    else if (arg.startsWith('--years=')) args.years = Number(arg.slice(8));
    else if (arg.startsWith('--concurrency=')) args.concurrency = Number(arg.slice(14));
    else if (arg === '--json') args.json = true;
    else if (arg === '--quiet') args.quiet = true;
    else {
      process.stderr.write(`Unknown flag: ${arg}\n`);
      process.exit(1);
    }
  }
  if (!SORTS[args.sort]) {
    process.stderr.write(`Unknown --sort=${args.sort}; expected one of ${Object.keys(SORTS).join(', ')}.\n`);
    process.exit(1);
  }
  return args;
}

/** One ticker's screen row, or null if it can't be scored. */
async function scoreTicker(symbol, years) {
  const config = STOCK_CONFIGS[symbol] || {};
  const { rows, longName } = await fetchYahoo(symbol, years);

  // The 50-week SMA needs 250 sessions before the score means anything.
  if (rows.length < 260) return null;

  const points = buildPoints(rows, config.riskThresholds);
  const last = points[points.length - 1];
  if (last.sma50 === 0) return null;

  const yearAgo = last.date.getTime() - 365 * 24 * 60 * 60 * 1000;
  const window = points.filter((p) => p.date.getTime() >= yearAgo);
  const high52w = Math.max(...window.map((p) => p.price));

  const dev = (ma) => (ma > 0 ? pct((last.price - ma) / ma) : null);
  const band = bandOf(last.risk);

  return {
    symbol,
    name: config.name || longName || symbol,
    price: money(last.price),
    risk: last.risk,
    band: `${band}-${band + 1}`,
    level: riskDescription(last.risk).level,
    riskPercentilePct: pct(riskPercentile(points, last.risk)),
    vsEma8wPct: dev(last.ema8),
    vsEma21wPct: dev(last.ema21),
    vsSma50wPct: dev(last.sma50),
    vsSma200wPct: dev(last.sma200),
    fromHigh52wPct: pct(last.price / high52w - 1),
    return3mPct: pct(trailingReturn(points, 91)),
    return1yPct: pct(trailingReturn(points, 365)),
    avgDollarVolume: Math.round(avgDollarVolume(points, 30) || 0),
    sessions: points.length,
    asOf: last.date.toISOString().slice(0, 10),
  };
}

function formatTable(rows, limit) {
  const cols = [
    ['SYMBOL', (r) => r.symbol, 7],
    ['PRICE', (r) => (r.price == null ? '-' : `$${r.price.toFixed(2)}`), 10],
    ['RISK', (r) => r.risk.toFixed(2), 6],
    ['LEVEL', (r) => r.level.replace(' Risk', ''), 15],
    ['%ILE', (r) => (r.riskPercentilePct == null ? '-' : `${r.riskPercentilePct.toFixed(0)}%`), 6],
    ['vs8WEMA', (r) => (r.vsEma8wPct == null ? '-' : `${r.vsEma8wPct > 0 ? '+' : ''}${r.vsEma8wPct.toFixed(1)}%`), 9],
    ['vs50WSMA', (r) => (r.vsSma50wPct == null ? '-' : `${r.vsSma50wPct > 0 ? '+' : ''}${r.vsSma50wPct.toFixed(1)}%`), 10],
    ['OFF HIGH', (r) => (r.fromHigh52wPct == null ? '-' : `${r.fromHigh52wPct.toFixed(1)}%`), 10],
    ['1Y', (r) => (r.return1yPct == null ? '-' : `${r.return1yPct > 0 ? '+' : ''}${r.return1yPct.toFixed(0)}%`), 8],
    ['NAME', (r) => r.name.slice(0, 30), 30],
  ];

  const header = cols.map(([label, , width]) => label.padEnd(width)).join('');
  const lines = [header, '-'.repeat(header.length)];
  for (const row of rows.slice(0, limit)) {
    lines.push(cols.map(([, get, width]) => String(get(row)).padEnd(width)).join(''));
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = (msg) => {
    if (!args.quiet) process.stderr.write(msg);
  };

  const { name: universeName, symbols } = await resolveUniverse(args.universe);
  log(`Universe: ${universeName} — ${symbols.length} symbols\n`);
  if (symbols.length > 1000) {
    log(`Large universe; expect roughly ${Math.ceil((symbols.length * 0.12) / 60)} min.\n`);
  }

  let done = 0;
  const failures = [];
  const scored = await mapConcurrent(symbols, args.concurrency, async (symbol) => {
    try {
      return await scoreTicker(symbol, args.years);
    } catch (err) {
      failures.push({ symbol, error: err.message });
      return null;
    } finally {
      done++;
      if (!args.quiet && done % 50 === 0) log(`  scored ${done}/${symbols.length}\n`);
    }
  });

  let rows = scored.filter(Boolean);
  const scannedCount = rows.length;

  if (args.minDollarVolume > 0) rows = rows.filter((r) => r.avgDollarVolume >= args.minDollarVolume);
  if (Number.isFinite(args.maxRisk)) rows = rows.filter((r) => r.risk <= args.maxRisk);
  if (Number.isFinite(args.minRisk)) rows = rows.filter((r) => r.risk >= args.minRisk);

  rows.sort(SORTS[args.sort]);

  log(`Scored ${scannedCount}, ${failures.length} failed, ${rows.length} passed filters.\n\n`);

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          universe: universeName,
          generatedAt: new Date().toISOString(),
          sort: args.sort,
          filters: {
            maxRisk: args.maxRisk ?? null,
            minRisk: args.minRisk ?? null,
            minDollarVolume: args.minDollarVolume,
          },
          scanned: scannedCount,
          failed: failures.length,
          matched: rows.length,
          results: rows.slice(0, args.limit),
        },
        null,
        2
      ) + '\n'
    );
    return;
  }

  if (rows.length === 0) {
    process.stdout.write('No tickers matched those filters.\n');
    return;
  }

  process.stdout.write(formatTable(rows, args.limit) + '\n');
  process.stdout.write(
    `\nShowing ${Math.min(args.limit, rows.length)} of ${rows.length} matches. ` +
      `Run snapshot.mjs --symbol=<SYM> for the full read before acting on any row.\n`
  );
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
