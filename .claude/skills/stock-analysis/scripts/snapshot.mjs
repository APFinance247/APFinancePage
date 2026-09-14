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
 * The risk algorithm is a faithful port of `calculateEMAFocusedRisk` in
 * scripts/generate-all-stock-csvs.js, including the per-symbol thresholds,
 * so the numbers here match the published CSVs and the site's charts.
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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CSV_DIR = path.join(REPO_ROOT, 'public', 'stock-data');

const CRYPTO = ['BTC', 'ETH', 'DOGE', 'ADA', 'SOL'];

// Per-symbol risk thresholds, mirroring STOCK_CONFIGS in
// scripts/generate-all-stock-csvs.js. Symbols not listed use the defaults.
const STOCK_CONFIGS = {
  VOO: { name: 'Vanguard S&P 500 ETF', riskThresholds: { yellowTerritory: 0.10, elevatedTerritory: 0.05, nearEMA: -0.03 } },
  NVDA: { name: 'NVIDIA Corporation' },
  MSFT: { name: 'Microsoft Corporation' },
  AAPL: { name: 'Apple Inc.' },
  GOOGL: { name: 'Alphabet Inc.' },
  AMZN: { name: 'Amazon.com Inc.' },
  TSLA: { name: 'Tesla Inc.', riskThresholds: { yellowTerritory: 0.20, elevatedTerritory: 0.10, nearEMA: -0.08 } },
  META: { name: 'Meta Platforms Inc.', riskThresholds: { yellowTerritory: 0.18, elevatedTerritory: 0.10, nearEMA: -0.08 } },
  BTC: { name: 'Bitcoin', riskThresholds: { yellowTerritory: 0.25, elevatedTerritory: 0.15, nearEMA: -0.10 } },
  ETH: { name: 'Ethereum', riskThresholds: { yellowTerritory: 0.25, elevatedTerritory: 0.15, nearEMA: -0.10 } },
  UNH: { name: 'UnitedHealth Group Inc.', riskThresholds: { yellowTerritory: 0.15, elevatedTerritory: 0.08, nearEMA: -0.05 } },
  GRAL: { name: 'GRAIL, Inc.', riskThresholds: { yellowTerritory: 0.20, elevatedTerritory: 0.10, nearEMA: -0.08 } },
};

const DEFAULT_THRESHOLDS = { yellowTerritory: 0.15, elevatedTerritory: 0.08, nearEMA: -0.05 };

// ---------------------------------------------------------------- indicators

function calculateSMA(data, period) {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(0);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      sma.push(sum / period);
    }
  }
  return sma;
}

function calculateEMA(data, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i === 0) ema.push(data[i]);
    else ema.push(data[i] * multiplier + ema[i - 1] * (1 - multiplier));
  }
  return ema;
}

// ------------------------------------------------------------------ the risk
// Port of calculateEMAFocusedRisk. `dataPoints` carry risk: 5 on input and the
// map reads the *input* array for smoothing, exactly as the generator does —
// keep it that way or these scores drift from the published CSVs.

function calculateEMAFocusedRisk(dataPoints, riskThresholds = {}) {
  const currentDate = new Date();
  const t = { ...DEFAULT_THRESHOLDS, ...riskThresholds };

  return dataPoints.map((point, index) => {
    if (point.sma50 === 0 || point.ema8 === 0 || point.ema21 === 0) {
      return { ...point, risk: 5 };
    }

    const yearsFromNow = (currentDate.getTime() - point.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const modernWeight = Math.max(0, Math.min(1, (5 - yearsFromNow) / 5));

    const dev8EMA = (point.price - point.ema8) / point.ema8;
    const dev21EMA = (point.price - point.ema21) / point.ema21;
    const dev50SMA = (point.price - point.sma50) / point.sma50;
    const dev100SMA = (point.price - point.sma100) / point.sma100;
    const dev200SMA = (point.price - point.sma200) / point.sma200;

    let risk;

    // STEP 1: base risk from position relative to the 8-week EMA
    if (dev8EMA >= t.yellowTerritory) {
      if (dev8EMA >= t.yellowTerritory * 2) risk = 9.5;
      else if (dev8EMA >= t.yellowTerritory * 1.5) risk = 9.0;
      else if (dev8EMA >= t.yellowTerritory * 1.2) risk = 8.5;
      else risk = 8.0;
    } else if (dev8EMA >= t.elevatedTerritory) {
      const range = t.yellowTerritory - t.elevatedTerritory;
      risk = 6.5 + ((dev8EMA - t.elevatedTerritory) / range) * 1.5;
    } else if (dev8EMA >= t.nearEMA) {
      const range = t.elevatedTerritory - t.nearEMA;
      risk = 5.0 + ((dev8EMA - t.nearEMA) / range) * 1.5;
    } else if (dev21EMA >= -0.08) {
      if (dev21EMA >= 0) risk = 4.0 + (dev21EMA / 0.08) * 1.0;
      else risk = 3.0 + ((dev21EMA + 0.08) / 0.08) * 1.0;
    } else {
      const deepestDeviation = Math.min(dev50SMA, dev100SMA, dev200SMA);
      if (deepestDeviation <= -0.25) risk = 1.0;
      else if (deepestDeviation <= -0.15) risk = 1.5;
      else if (deepestDeviation <= -0.08) risk = 2.0;
      else if (dev50SMA <= -0.03) risk = 2.5;
      else risk = 3.0;
    }

    // STEP 2: recent data gets slightly wider lows and stricter highs
    if (modernWeight > 0.7) {
      if (risk <= 3) risk -= 0.2;
      else if (risk >= 7) risk += 0.1;
    }

    // STEP 3: high realised volatility discounts the score
    if (modernWeight > 0.3 && index > 50) {
      const recentPrices = dataPoints.slice(Math.max(0, index - 20), index + 1).map((p) => p.price);
      const changes = recentPrices.slice(1).map((price, i) => (price - recentPrices[i]) / recentPrices[i]);
      const volatility = Math.sqrt(changes.reduce((sum, c) => sum + c * c, 0) / changes.length);
      if (volatility > 0.06) risk -= 0.2;
      else if (volatility > 0.04) risk -= 0.1;
    }

    // STEP 4: trend consistency across 8W/21W/50W
    const trendAlignment = ((dev8EMA > 0 ? 1 : -1) + (dev21EMA > 0 ? 1 : -1) + (dev50SMA > 0 ? 1 : -1)) / 3;
    if (Math.abs(trendAlignment) > 0.6) risk += trendAlignment * 0.15;

    // STEP 5: bounds, then light smoothing
    risk = Math.max(1, Math.min(10, risk));
    if (index > 0 && index < dataPoints.length - 1) {
      const prevRisk = dataPoints[index - 1]?.risk || risk;
      risk = risk * 0.8 + prevRisk * 0.2;
    }

    return { ...point, risk: Math.round(risk * 100) / 100 };
  });
}

function riskDescription(risk) {
  if (risk <= 2) return { level: 'Very Low Risk', description: 'Extreme undervaluation - historically rare buying opportunity' };
  if (risk <= 3) return { level: 'Low Risk', description: 'Below key support levels - good value territory' };
  if (risk <= 4) return { level: 'Low-Moderate Risk', description: 'Below historical average - reasonable entry point' };
  if (risk <= 6) return { level: 'Moderate Risk', description: 'Fair value range - consider market conditions' };
  if (risk <= 7) return { level: 'Moderate-High Risk', description: 'Above historical average - elevated valuation' };
  if (risk <= 8.5) return { level: 'High Risk', description: 'Top 25% of historical valuations - proceed with caution' };
  if (risk <= 9) return { level: 'Very High Risk', description: 'Top 10% of historical valuations - high risk territory' };
  return { level: 'Extreme Risk', description: 'Top 5% of historical deviations - extreme overextension' };
}

// ----------------------------------------------------------------- data load

async function fetchYahoo(symbol) {
  const yahooSymbol = CRYPTO.includes(symbol) ? `${symbol}-USD` : symbol;
  // Explicit period1/period2 — `range=max` silently downgrades to monthly bars.
  const period1 = Math.floor(Date.UTC(1980, 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${yahooSymbol}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp || !result?.indicators?.quote?.[0]?.close) {
    throw new Error(`No price data returned for ${yahooSymbol}`);
  }

  const closes = result.indicators.quote[0].close;
  const rows = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    if (closes[i] != null) {
      rows.push({ date: new Date(result.timestamp[i] * 1000), price: closes[i] });
    }
  }
  return { rows, source: 'Yahoo Finance', longName: result.meta?.longName || result.meta?.shortName };
}

function loadCsv(symbol) {
  const file = path.join(CSV_DIR, `${symbol}.csv`);
  if (!fs.existsSync(file)) throw new Error(`No local CSV for ${symbol} (${file})`);

  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const rows = [];
  for (const line of lines.slice(1)) {
    const [dateStr, priceStr] = line.split(',');
    const price = parseFloat(priceStr);
    if (Number.isFinite(price) && price > 0) rows.push({ date: new Date(dateStr), price });
  }
  if (rows.length === 0) throw new Error(`CSV for ${symbol} contained no usable rows`);
  return { rows, source: `local CSV (public/stock-data/${symbol}.csv)` };
}

async function loadPrices(symbol, source) {
  if (source === 'csv') return loadCsv(symbol);
  if (source === 'yahoo') return fetchYahoo(symbol);
  try {
    return await fetchYahoo(symbol);
  } catch (err) {
    process.stderr.write(`Yahoo fetch failed (${err.message}); falling back to local CSV.\n`);
    return loadCsv(symbol);
  }
}

// ------------------------------------------------------------------ analytics

const pct = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 10 : null);
const pct2 = (x) => (Number.isFinite(x) ? Math.round(x * 10000) / 100 : null);
const money = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

/** Trailing return over `days` calendar days, as a fraction. */
function trailingReturn(points, days) {
  const last = points[points.length - 1];
  const cutoff = last.date.getTime() - days * 24 * 60 * 60 * 1000;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].date.getTime() <= cutoff) return last.price / points[i].price - 1;
  }
  return null;
}

function ytdReturn(points) {
  const last = points[points.length - 1];
  const jan1 = new Date(Date.UTC(last.date.getUTCFullYear(), 0, 1)).getTime();
  for (let i = 0; i < points.length; i++) {
    if (points[i].date.getTime() >= jan1) {
      const base = i > 0 ? points[i - 1] : points[i];
      return last.price / base.price - 1;
    }
  }
  return null;
}

/** Annualised stdev of daily returns over the last `n` sessions. */
function annualisedVol(points, n) {
  if (points.length < n + 1) return null;
  const slice = points.slice(-(n + 1));
  const changes = slice.slice(1).map((p, i) => p.price / slice[i].price - 1);
  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance = changes.reduce((a, c) => a + (c - mean) ** 2, 0) / changes.length;
  return Math.sqrt(variance) * Math.sqrt(252);
}

/** Band = integer floor of the risk score, so 6.4 and 6.9 share band "6-7". */
const bandOf = (risk) => Math.min(9, Math.max(1, Math.floor(risk)));

/**
 * What happened historically after this ticker last sat in the current risk
 * band? Returns median/average forward return and win rate per horizon.
 */
function bandForwardReturns(points, band) {
  const horizons = { m1: 21, m3: 63, m6: 126, m12: 252 };
  const matches = [];
  // Skip the warm-up window where risk is the hardcoded 5 placeholder.
  for (let i = 0; i < points.length; i++) {
    if (points[i].sma50 === 0) continue;
    if (bandOf(points[i].risk) === band) matches.push(i);
  }

  const out = { band: `${band}-${band + 1}`, occurrences: matches.length, sessions: {} };
  for (const [key, h] of Object.entries(horizons)) {
    const rets = [];
    for (const i of matches) {
      const j = i + h;
      if (j < points.length) rets.push(points[j].price / points[i].price - 1);
    }
    if (rets.length === 0) {
      out.sessions[key] = null;
      continue;
    }
    const sorted = [...rets].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    out.sessions[key] = {
      medianPct: pct(median),
      avgPct: pct(rets.reduce((a, b) => a + b, 0) / rets.length),
      winRatePct: pct(rets.filter((r) => r > 0).length / rets.length),
      worstPct: pct(sorted[0]),
      bestPct: pct(sorted[sorted.length - 1]),
      samples: rets.length,
    };
  }
  return out;
}

/** How many consecutive recent sessions have stayed in the same band. */
function bandStreak(points, band) {
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (bandOf(points[i].risk) !== band) break;
    streak++;
  }
  return streak;
}

// ----------------------------------------------------------------------- main

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

  rows.sort((a, b) => a.date - b.date);
  const prices = rows.map((r) => r.price);

  const ema8 = calculateEMA(prices, 8 * 5);
  const ema21 = calculateEMA(prices, 21 * 5);
  const sma50 = calculateSMA(prices, 50 * 5);
  const sma100 = calculateSMA(prices, 100 * 5);
  const sma200 = calculateSMA(prices, 200 * 5);
  const sma400 = calculateSMA(prices, 400 * 5);

  const seeded = rows.map((r, i) => ({
    date: r.date,
    price: r.price,
    ema8: ema8[i],
    ema21: ema21[i],
    sma50: sma50[i],
    sma100: sma100[i],
    sma200: sma200[i],
    sma400: sma400[i],
    risk: 5,
  }));

  const points = calculateEMAFocusedRisk(seeded, config.riskThresholds);
  const last = points[points.length - 1];
  const prev = points[points.length - 2] || last;

  // Risk context: where today's score sits in this ticker's own history.
  const scored = points.filter((p) => p.sma50 !== 0);
  const risks = scored.map((p) => p.risk);
  const below = risks.filter((r) => r < last.risk).length;
  const band = bandOf(last.risk);

  const high52wWindow = points.filter(
    (p) => p.date.getTime() >= last.date.getTime() - 365 * 24 * 60 * 60 * 1000
  );
  const high52w = Math.max(...high52wWindow.map((p) => p.price));
  const low52w = Math.min(...high52wWindow.map((p) => p.price));
  const ath = Math.max(...prices);

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
