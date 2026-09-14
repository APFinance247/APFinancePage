/**
 * Ticker universes — the "what do I even look at" half of the workflow.
 *
 * All sources are free and keyless. Listings are cached under
 * .claude/skills/stock-analysis/.cache/ for a day so repeat scans don't
 * re-fetch; delete that directory to force a refresh.
 */

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, CSV_DIR } from './risk-engine.mjs';

const CACHE_DIR = path.join(REPO_ROOT, '.claude', 'skills', 'stock-analysis', '.cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SP500_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
const NASDAQ_DIR_URL = 'https://www.nasdaqtrader.com/dynamic/symdir/nasdaqtraded.txt';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function cachedFetch(key, url) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, key);

  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < CACHE_TTL_MS) {
    return fs.readFileSync(file, 'utf8');
  }

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    // A stale cache beats no universe at all.
    if (fs.existsSync(file)) {
      process.stderr.write(`${url} returned ${res.status}; using stale cache.\n`);
      return fs.readFileSync(file, 'utf8');
    }
    throw new Error(`${url} returned ${res.status}`);
  }

  const text = await res.text();
  fs.writeFileSync(file, text);
  return text;
}

/** S&P 500 constituents, scraped from the Wikipedia table. */
async function sp500() {
  const html = await cachedFetch('sp500.html', SP500_URL);
  const marker = html.split('id="constituents"', 2)[1];
  if (!marker) throw new Error('Could not find the constituents table on the S&P 500 page');

  const table = marker.split('</table>', 1)[0];
  const symbols = [];
  for (const row of table.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells) continue;
    const symbol = cells[0].replace(/<[^>]+>/g, '').trim();
    if (/^[A-Z][A-Z.\-]{0,6}$/.test(symbol)) symbols.push(symbol);
  }
  if (symbols.length < 400) throw new Error(`S&P 500 parse looks wrong (${symbols.length} symbols)`);
  return symbols;
}

/**
 * Every US-traded common stock from the Nasdaq symbol directory.
 *
 * Drops ETFs, test issues, and anything that isn't common stock or ordinary
 * shares — warrants, units, rights and preferreds would otherwise be ~40% of
 * the list and none of them mean anything to the risk model.
 *
 * @param {'Q'|null} exchange 'Q' for Nasdaq-listed only, null for all exchanges.
 */
async function nasdaqDirectory(exchange) {
  const text = await cachedFetch('nasdaqtraded.txt', NASDAQ_DIR_URL);
  const symbols = [];

  for (const line of text.split('\n').slice(1)) {
    const f = line.split('|');
    if (f.length < 11) continue; // header, footer, or a truncated line

    const [traded, symbol, name, listingExchange, , etf, , testIssue] = f;
    if (traded !== 'Y' || etf !== 'N' || testIssue !== 'N') continue;
    if (!/Common Stock|Ordinary Shares/.test(name)) continue;
    if (exchange && listingExchange !== exchange) continue;
    // Yahoo doesn't recognise the $-suffixed preferred/when-issued forms.
    if (!/^[A-Z]{1,5}$/.test(symbol)) continue;

    symbols.push(symbol);
  }

  if (symbols.length < 1000) throw new Error(`Symbol directory parse looks wrong (${symbols.length} symbols)`);
  return symbols;
}

/** The tickers the site already tracks daily. */
function tracked() {
  if (!fs.existsSync(CSV_DIR)) return [];
  return fs
    .readdirSync(CSV_DIR)
    .filter((f) => f.endsWith('.csv'))
    .map((f) => f.replace(/\.csv$/, ''))
    .sort();
}

/**
 * Resolve a --universe value to a symbol list.
 *
 *   sp500     S&P 500 constituents (~500)
 *   nasdaq    Nasdaq-listed common stocks (~3000)
 *   all       every US-traded common stock (~4800)
 *   tracked   tickers with a CSV in public/stock-data
 *   file:PATH newline- or comma-separated symbols from a file
 *   AMD,SNDK  an explicit comma-separated list
 */
export async function resolveUniverse(spec) {
  const value = (spec || 'sp500').trim();

  switch (value.toLowerCase()) {
    case 'sp500':
    case 's&p500':
      return { name: 'S&P 500', symbols: await sp500() };
    case 'nasdaq':
      return { name: 'Nasdaq-listed common stocks', symbols: await nasdaqDirectory('Q') };
    case 'all':
      return { name: 'All US-traded common stocks', symbols: await nasdaqDirectory(null) };
    case 'tracked':
      return { name: 'Tracked on the site', symbols: tracked() };
    default:
      break;
  }

  if (value.toLowerCase().startsWith('file:')) {
    const file = path.resolve(value.slice(5));
    const symbols = fs
      .readFileSync(file, 'utf8')
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return { name: `file ${path.basename(file)}`, symbols };
  }

  const symbols = value
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (symbols.length === 0) throw new Error(`Could not read a universe from "${spec}"`);
  return { name: `custom list (${symbols.length})`, symbols };
}
