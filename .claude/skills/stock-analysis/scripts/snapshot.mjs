#!/usr/bin/env node
/**
 * Risk snapshot for a single ticker.
 *
 * Produces the quantitative half of a stock analysis: current price, the
 * APFinance risk score (1-10), deviation from every key moving average,
 * drawdown/52-week context, trailing returns, and — most usefully — what
 * historically happened to this ticker the last time its risk score sat in
 * the same band.
 *
 * Scoring lives in lib/risk-engine.mjs and matches the published CSVs exactly.
 * To find candidates rather than analyse a known one, use screen.mjs first.
 *
 * Usage:
 *   node snapshot.mjs --symbol=NVDA
 *   node snapshot.mjs --symbol=AMD --source=yahoo
 *   node snapshot.mjs --symbol=NVDA --source=csv --pretty
 *
 * Flags:
 *   --symbol=SYM    Ticker (required). Crypto: BTC, ETH, SOL, ... auto-mapped to -USD.
 *   --source=...    auto (default) | yahoo | csv
 *   --pretty        Indented JSON instead of compact.
 */

import {
  STOCK_CONFIGS,
  DEFAULT_THRESHOLDS,
  annualisedVol,
  avgDollarVolume,
  bandForwardReturns,
  bandOf,
  bandStreak,
  buildPoints,
  loadPrices,
  money,
  pct,
  pct2,
  riskDescription,
  trailingReturn,
  ytdReturn,
} from './lib/risk-engine.mjs';

function parseArgs(argv) {
  const args = { source: 'auto', pretty: false };
  for (const arg of argv) {
    if (arg.startsWith('--symbol=')) args.symbol = arg.slice(9).toUpperCase();
    else if (arg.startsWith('--source=')) args.source = arg.slice(9).toLowerCase();
    else if (arg === '--pretty') args.pretty = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.symbol) {
    process.stderr.write('Usage: node snapshot.mjs --symbol=NVDA [--source=auto|yahoo|csv] [--pretty]\n');
    process.exit(1);
  }
  if (!['auto', 'yahoo', 'csv'].includes(args.source)) {
    process.stderr.write(`Unknown --source=${args.source}; expected auto, yahoo or csv.\n`);
    process.exit(1);
  }

  const symbol = args.symbol;
  const config = STOCK_CONFIGS[symbol] || {};
  const { rows, source, longName } = await loadPrices(symbol, args.source);

  const points = buildPoints(rows, config.riskThresholds);
  const last = points[points.length - 1];
  const prev = points[points.length - 2] || last;

  // Risk context: where today's score sits in this ticker's own history.
  const scored = points.filter((p) => p.sma50 !== 0);
  const risks = scored.map((p) => p.risk);
  const below = risks.filter((r) => r < last.risk).length;
  const band = bandOf(last.risk);

  const yearAgo = last.date.getTime() - 365 * 24 * 60 * 60 * 1000;
  const window = points.filter((p) => p.date.getTime() >= yearAgo);
  const high52w = Math.max(...window.map((p) => p.price));
  const low52w = Math.min(...window.map((p) => p.price));
  const ath = Math.max(...points.map((p) => p.price));

  // A moving average of 0 means the window hasn't filled yet — report it as
  // unavailable rather than as a price of zero.
  const ma = (value) => ({
    value: value > 0 ? money(value) : null,
    devPct: value > 0 ? pct((last.price - value) / value) : null,
  });

  const snapshot = {
    symbol,
    name: config.name || longName || symbol,
    asOf: last.date.toISOString().slice(0, 10),
    source,
    dataPoints: points.length,
    dateRange: [points[0].date.toISOString().slice(0, 10), last.date.toISOString().slice(0, 10)],

    price: {
      current: money(last.price),
      prevClose: money(prev.price),
      changePct: pct2(last.price / prev.price - 1),
      avgDollarVolume30d: Math.round(avgDollarVolume(points, 30) || 0) || null,
    },

    risk: {
      score: last.risk,
      band: `${band}-${band + 1}`,
      ...riskDescription(last.risk),
      percentileOfOwnHistory: pct(below / risks.length),
      historicalAvg: Math.round((risks.reduce((a, b) => a + b, 0) / risks.length) * 100) / 100,
      historicalMin: Math.min(...risks),
      historicalMax: Math.max(...risks),
      sessionsInBand: bandStreak(points, band),
      thresholds: { ...DEFAULT_THRESHOLDS, ...config.riskThresholds },
      distributionPct: {
        '1-3': pct(risks.filter((r) => r <= 3).length / risks.length),
        '3-6': pct(risks.filter((r) => r > 3 && r <= 6).length / risks.length),
        '6-8': pct(risks.filter((r) => r > 6 && r <= 8).length / risks.length),
        '8-10': pct(risks.filter((r) => r > 8).length / risks.length),
      },
    },

    movingAverages: {
      ema8w: ma(last.ema8),
      ema21w: ma(last.ema21),
      sma50w: ma(last.sma50),
      sma100w: ma(last.sma100),
      sma200w: ma(last.sma200),
      sma400w: ma(last.sma400),
    },

    levels: {
      high52w: money(high52w),
      low52w: money(low52w),
      fromHigh52wPct: pct(last.price / high52w - 1),
      fromLow52wPct: pct(last.price / low52w - 1),
      allTimeHigh: money(ath),
      fromAllTimeHighPct: pct(last.price / ath - 1),
    },

    returns: {
      w1Pct: pct(trailingReturn(points, 7)),
      m1Pct: pct(trailingReturn(points, 30)),
      m3Pct: pct(trailingReturn(points, 91)),
      m6Pct: pct(trailingReturn(points, 182)),
      ytdPct: pct(ytdReturn(points)),
      y1Pct: pct(trailingReturn(points, 365)),
      y3Pct: pct(trailingReturn(points, 1095)),
      y5Pct: pct(trailingReturn(points, 1826)),
    },

    volatility: {
      annualised30dPct: pct(annualisedVol(points, 30)),
      annualised1yPct: pct(annualisedVol(points, 252)),
    },

    // The headline stat: historically, buying this name at today's risk band
    // produced these forward returns. Base rates, not predictions.
    bandHistory: bandForwardReturns(points, band),
  };

  process.stdout.write(JSON.stringify(snapshot, null, args.pretty ? 2 : 0) + '\n');
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
