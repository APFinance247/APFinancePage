/**
 * Shared risk engine — indicators, the 1-10 score, and price loading.
 *
 * `snapshot.mjs` (one ticker, deep) and `screen.mjs` (many tickers, shallow)
 * both import from here. The repo already carries three copies of this
 * algorithm; don't add a fourth.
 *
 * The scoring is a faithful port of `calculateEMAFocusedRisk` in
 * scripts/generate-all-stock-csvs.js, per-symbol thresholds included, so a
 * score computed here matches the published CSVs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../../../../..');
export const CSV_DIR = path.join(REPO_ROOT, 'public', 'stock-data');

const CRYPTO = ['BTC', 'ETH', 'DOGE', 'ADA', 'SOL'];

export const DEFAULT_THRESHOLDS = { yellowTerritory: 0.15, elevatedTerritory: 0.08, nearEMA: -0.05 };

// Mirrors STOCK_CONFIGS in scripts/generate-all-stock-csvs.js.
export const STOCK_CONFIGS = {
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

// ---------------------------------------------------------------- formatting

export const pct = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 10 : null);
export const pct2 = (x) => (Number.isFinite(x) ? Math.round(x * 10000) / 100 : null);
export const money = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

// ---------------------------------------------------------------- indicators

export function calculateSMA(data, period) {
  const sma = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    sma.push(i < period - 1 ? 0 : sum / period);
  }
  return sma;
}

export function calculateEMA(data, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i === 0) ema.push(data[i]);
    else ema.push(data[i] * multiplier + ema[i - 1] * (1 - multiplier));
  }
  return ema;
}

// ------------------------------------------------------------------ the risk

/**
 * Port of calculateEMAFocusedRisk. `dataPoints` carry risk: 5 on input and the
 * map reads the *input* array for smoothing, exactly as the generator does —
 * keep it that way or these scores drift from the published CSVs.
 */
export function calculateEMAFocusedRisk(dataPoints, riskThresholds = {}) {
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

    // STEP 1: base score from position relative to the 8-week EMA
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

export function riskDescription(risk) {
  if (risk <= 2) return { level: 'Very Low Risk', description: 'Extreme undervaluation - historically rare buying opportunity' };
  if (risk <= 3) return { level: 'Low Risk', description: 'Below key support levels - good value territory' };
  if (risk <= 4) return { level: 'Low-Moderate Risk', description: 'Below historical average - reasonable entry point' };
  if (risk <= 6) return { level: 'Moderate Risk', description: 'Fair value range - consider market conditions' };
  if (risk <= 7) return { level: 'Moderate-High Risk', description: 'Above historical average - elevated valuation' };
  if (risk <= 8.5) return { level: 'High Risk', description: 'Top 25% of historical valuations - proceed with caution' };
  if (risk <= 9) return { level: 'Very High Risk', description: 'Top 10% of historical valuations - high risk territory' };
  return { level: 'Extreme Risk', description: 'Top 5% of historical deviations - extreme overextension' };
}

/** Band = integer floor of the risk score, so 6.4 and 6.9 share band "6-7". */
export const bandOf = (risk) => Math.min(9, Math.max(1, Math.floor(risk)));

// ----------------------------------------------------------------- data load

/**
 * Daily closes (and volume) from the free Yahoo chart endpoint.
 *
 * Uses explicit period bounds — `range=max` silently downgrades to monthly
 * bars, which produces a confidently wrong score.
 *
 * @param {string} symbol
 * @param {number} [years] history depth; omit for everything available.
 */
export async function fetchYahoo(symbol, years) {
  // Yahoo writes share classes with a dash (BRK-B), index listings with a dot.
  const yahooSymbol = CRYPTO.includes(symbol) ? `${symbol}-USD` : symbol.replace(/\./g, '-');
  const start = years
    ? new Date(Date.now() - years * 365.25 * 24 * 60 * 60 * 1000)
    : new Date(Date.UTC(1980, 0, 1));
  const period1 = Math.floor(start.getTime() / 1000);
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

  const quote = result.indicators.quote[0];
  const rows = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    if (quote.close[i] != null) {
      rows.push({
        date: new Date(result.timestamp[i] * 1000),
        price: quote.close[i],
        volume: quote.volume?.[i] ?? 0,
      });
    }
  }
  return { rows, source: 'Yahoo Finance', longName: result.meta?.longName || result.meta?.shortName };
}

export function loadCsv(symbol) {
  const file = path.join(CSV_DIR, `${symbol}.csv`);
  if (!fs.existsSync(file)) throw new Error(`No local CSV for ${symbol} (${file})`);

  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const rows = [];
  for (const line of lines.slice(1)) {
    const [dateStr, priceStr] = line.split(',');
    const price = parseFloat(priceStr);
    if (Number.isFinite(price) && price > 0) rows.push({ date: new Date(dateStr), price, volume: 0 });
  }
  if (rows.length === 0) throw new Error(`CSV for ${symbol} contained no usable rows`);
  return { rows, source: `local CSV (public/stock-data/${symbol}.csv)` };
}

export async function loadPrices(symbol, source = 'auto', years) {
  if (source === 'csv') return loadCsv(symbol);
  if (source === 'yahoo') return fetchYahoo(symbol, years);
  try {
    return await fetchYahoo(symbol, years);
  } catch (err) {
    process.stderr.write(`Yahoo fetch failed for ${symbol} (${err.message}); falling back to local CSV.\n`);
    return loadCsv(symbol);
  }
}

/** Raw price rows -> scored points carrying every moving average. */
export function buildPoints(rows, riskThresholds) {
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
    volume: r.volume ?? 0,
    ema8: ema8[i],
    ema21: ema21[i],
    sma50: sma50[i],
    sma100: sma100[i],
    sma200: sma200[i],
    sma400: sma400[i],
    risk: 5,
  }));

  return calculateEMAFocusedRisk(seeded, riskThresholds);
}

// ------------------------------------------------------------------ analytics

/** Trailing return over `days` calendar days, as a fraction. */
export function trailingReturn(points, days) {
  const last = points[points.length - 1];
  const cutoff = last.date.getTime() - days * 24 * 60 * 60 * 1000;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].date.getTime() <= cutoff) return last.price / points[i].price - 1;
  }
  return null;
}

export function ytdReturn(points) {
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
export function annualisedVol(points, n) {
  if (points.length < n + 1) return null;
  const slice = points.slice(-(n + 1));
  const changes = slice.slice(1).map((p, i) => p.price / slice[i].price - 1);
  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance = changes.reduce((a, c) => a + (c - mean) ** 2, 0) / changes.length;
  return Math.sqrt(variance) * Math.sqrt(252);
}

/** Average close x volume over the last `n` sessions — the liquidity filter. */
export function avgDollarVolume(points, n = 30) {
  const slice = points.slice(-n);
  if (slice.length === 0) return null;
  const total = slice.reduce((sum, p) => sum + p.price * (p.volume || 0), 0);
  return total / slice.length;
}

/**
 * What happened historically after this ticker last sat in the current risk
 * band? Median/average forward return and win rate per horizon.
 */
export function bandForwardReturns(points, band) {
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
export function bandStreak(points, band) {
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (bandOf(points[i].risk) !== band) break;
    streak++;
  }
  return streak;
}

/** Share of scored history spent below `risk`. */
export function riskPercentile(points, risk) {
  const scored = points.filter((p) => p.sma50 !== 0).map((p) => p.risk);
  if (scored.length === 0) return null;
  return scored.filter((r) => r < risk).length / scored.length;
}

/** Run `fn` over `items` with bounded concurrency, preserving input order. */
export async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
