// Token Launch Radar — value model (token-radar-01).
//
// The board ranks pre-token protocols by an implied value that is fitted to the
// snapshot itself, never to a hardcoded list of names. The same function scores
// every row, and the dashboard states the formula and its validation.
//
// THE MODEL (radar-2, fitted at run time from the snapshot's own live protocols)
//
//   1. Base — a power law, fitted by ordinary least squares in log space over
//      the snapshot's token-bearing protocols (those with a market cap and a
//      TVL, both positive):
//
//        ln(mcap) = a + b * ln(tvl)          (a, b fitted, not hardcoded)
//        base     = exp(a + b * ln(tvl_usd))
//
//      A flat multiple (mcap = k * TVL) assumes value scales one-for-one with
//      size. The snapshot says otherwise: log(mcap/TVL) falls as log(TVL)
//      rises (correlation -0.41), and the fitted slope is about 0.52 — value
//      grows with the square root of size, not with size. The power law is
//      the shape the data itself takes.
//
//   2. Growth — seven-day TVL momentum, clamped so one wild week cannot
//      dominate the board:
//
//        growth_pct = clamp(change_7d, -60, 120)   (null change_7d counts as 0)
//        growth_mult = 1 + growth_pct / 100 * 0.5
//
//   3. Maturity — how long the protocol has run with no token recorded.
//      Older means a longer track record; the effect is deliberately gentle:
//
//        age_days  = days from listed_at to the snapshot's as_of (null: 365)
//        maturity  = 0.85 + min(age_days, 1095) / 1095 * 0.15
//
//        implied = max(1, round(base * growth_mult * maturity))
//
// VALIDATION (leave-one-out, computed at run time by backtest() and printed
// by main.ts; the dashboard shows the same numbers)
//
//   Each token-bearing protocol is held out, the power law is refitted without
//   it, and its market cap is predicted from its own TVL, growth and age.
//   On this snapshot (128 protocols with a market cap):
//     median absolute error  ~86%  (typical factor ~3.4x)
//     predictions within 2x  ~30%
//   The same backtest for a flat global-median multiple gives ~87% median
//   error, and the starter's flat 0.25x rule gives ~89%. The power law wins
//   on every metric — and the residual spread is real: TVL alone predicts a
//   market cap only weakly (log correlation 0.44), so implied values here are
//   an order-of-magnitude ranking, not price targets. The board says so.
//
// WHAT GETS RANKED
//
//   A protocol is pre-token when the snapshot records no token for it: no
//   market cap, no CoinGecko id, no symbol. The board ranks every pre-token
//   protocol that is a standalone launch candidate — the snapshot's watchlist
//   (all 40, the floor) plus every other pre-token protocol below or above
//   the floor that is not one of these:
//     - an exchange (category CEX);
//     - a bridge, canonical bridge or cross-chain bridge;
//     - a liquid staking, liquid restaking or restaked-BTC product, or a
//       stablecoin wrapper — wrapped or staked products of tokens that
//       already trade (WBTC is Bitcoin on Ethereum; a staked-ETH receipt is
//       ETH in a staking product), not launches of their own;
//     - a name ending in a version marker (V2, v2, 2.0, ...), which is a
//       pool of another protocol;
//     - a name carrying a whole word wrapped, staked or staking, or beginning
//       with an exchange's name (Binance, Coinbase, Bybit, Kraken, Bitget,
//       OKX, Bitfinex, Gemini).
//   Protocols whose token already trades are set aside in the Live view with
//   the market's own market cap, never ranked as pre-token.
//
//   Every number shown comes from the snapshot. No protocol name is ever
//   special-cased. Language follows the snapshot: a protocol "records no
//   token", never "has no token".

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** The fitted power law's constants, computed from the snapshot at run time. */
export interface PowerLaw {
  intercept: number;
  slope: number;
  fitted_on: number;
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  power_law: PowerLaw;
}

export const MODEL_TUNING = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.85,
  maturity_range: 0.15,
  maturity_days: 1095,
  unknown_age_days: 365,
} as const;

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_value_usd: number;
    power_law_intercept: number;
    power_law_slope: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row, with its farm plan attached. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  growth_pct: number;
  watch: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The leave-one-out validation numbers the dashboard reports. */
export interface Validation {
  n: number;
  median_abs_pct_error: number;
  within_2x_pct: number;
  median_log_error: number;
  typical_factor: number;
  flat_multiple_median_abs_pct_error: number;
  starter_rule_median_abs_pct_error: number;
}

/** Everything the dashboard needs: the board, the live set, the model and its validation. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  power_law: PowerLaw;
  tuning: {
    growth_weight: number;
    growth_floor: number;
    growth_cap: number;
    maturity_floor: number;
    maturity_range: number;
    maturity_days: number;
    unknown_age_days: number;
  };
  validation: Validation;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The token-bearing protocols the power law is fitted on: a market cap and a TVL, both positive. */
export function fittable(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
}

/**
 * The power law, fitted by least squares in log space: ln(mcap) = a + b * ln(tvl).
 * Deterministic on the same input. Falls back to the starter's flat rule when
 * fewer than two protocols can be fitted (never on this snapshot).
 */
export function fitPowerLaw(protocols: SnapshotProtocol[]): PowerLaw {
  const pts = protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  if (pts.length < 2) return { intercept: Math.log(0.25), slope: 1, fitted_on: pts.length };
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += Math.log(p.tvl_usd);
    sy += Math.log(p.mcap_usd!);
  }
  const mx = sx / pts.length;
  const my = sy / pts.length;
  let sxy = 0;
  let sxx = 0;
  for (const p of pts) {
    const dx = Math.log(p.tvl_usd) - mx;
    sxy += dx * (Math.log(p.mcap_usd!) - my);
    sxx += dx * dx;
  }
  const slope = sxx === 0 ? 1 : sxy / sxx;
  return { intercept: my - slope * mx, slope, fitted_on: pts.length };
}

/** The three multipliers and the implied value one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  law: PowerLaw,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(MODEL_TUNING.growth_cap, Math.max(MODEL_TUNING.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * MODEL_TUNING.growth_weight;
  const ageForModel = age ?? MODEL_TUNING.unknown_age_days;
  const maturityMult =
    MODEL_TUNING.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), MODEL_TUNING.maturity_days) / MODEL_TUNING.maturity_days) *
      MODEL_TUNING.maturity_range;
  const base = Math.exp(law.intercept + law.slope * Math.log(Math.max(1, protocol.tvl_usd)));
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, base: Math.round(base), growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped, staked or staking in a name: a wrapped or staked product, not a launch. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** An exchange's name at the start of a name: the exchange's own product. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** Categories that are products of a token that already trades, not launches of their own. */
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Stablecoin Wrapper',
]);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token and a standalone launch candidate. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, law: PowerLaw): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, whatever its size.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other standalone pre-token protocol, above or below
  // the floor. Never a replacement for a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, law);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_value_usd: s.base,
      power_law_intercept: round4(law.intercept),
      power_law_slope: round4(law.slope),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

// ---------------------------------------------------------------- farm plans

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** A rough gas price for one transaction on the protocol's first chain, in whole dollars. */
function gasFor(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 9;
  if (c === 'solana') return 1;
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'polygon' || c === 'bsc' || c === 'avalanche') return 2;
  return 4;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The protocol's family, from its DefiLlama category: what a farmer can actually do there. */
function familyOf(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('dex')) return 'dex';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lend';
  if (c.includes('leveraged farm') || c.includes('yield') || c === 'farm') return 'yield';
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('basis')) return 'deriv';
  if (c.includes('prediction')) return 'predict';
  if (c.includes('rwa') || c.includes('stablecoin') || c.includes('anchor btc') || c.includes('decentralized btc')) return 'rwa';
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('liquidity manager') || c.includes('index')) return 'vault';
  if (c.includes('staking') || c.includes('restak')) return 'stake';
  if (c === 'chain') return 'chain';
  if (c.includes('insurance')) return 'insure';
  if (c.includes('payment')) return 'pay';
  if (c.includes('governance')) return 'gov';
  if (c.includes('card')) return 'card';
  if (c.includes('otc')) return 'otc';
  if (c.includes('cedefi')) return 'cedefi';
  return 'generic';
}

/** The family's first, capital-committing action, in the words a farmer can follow. */
function primaryAction(family: string, p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (family) {
    case 'dex':
      return `Swap $${capital} of USDC for the pool's other asset on ${name} on ${chain}, then provide $${capital} of liquidity to its main pool and keep the position open.`;
    case 'lend': {
      const borrow = Math.max(10, Math.round(capital / 2));
      return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow $${borrow} of a stable asset against it and keep both legs open.`;
    }
    case 'yield':
      return `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and keep the vault shares.`;
    case 'deriv':
      return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position, no more than a tenth of the deposit.`;
    case 'predict':
      return `Fund your ${name} account with $${capital} of USDC on ${chain} and place one position on a market that settles after the next snapshot window.`;
    case 'rwa':
      return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in your wallet.`;
    case 'vault':
      return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the vault shares.`;
    case 'stake':
      return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
    case 'chain':
      return `Bridge $${capital} of USDC to ${chain} through its official bridge and use it in one of ${name}'s own apps.`;
    case 'insure':
      return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
    case 'pay':
      return `Send $${capital} through ${name} on ${chain} to a second wallet you control and keep the receipt.`;
    case 'gov':
      return `Lock $${capital} in ${name}'s governance vault on ${chain} and cast one vote.`;
    case 'card':
      return `Top up $${capital} on your ${name} card and make one purchase with it.`;
    case 'otc':
      return `List $${capital} of USDC in one ${name} OTC order on ${chain} and settle it.`;
    case 'cedefi':
      return `Deposit $${capital} of USDC into ${name}'s CeDeFi vault on ${chain} and keep the position open.`;
    default:
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  }
}

/** The family's weekly qualifying action, so the position stays active. */
function weeklyAction(family: string, p: SnapshotProtocol): string {
  const name = p.name;
  switch (family) {
    case 'dex':
      return `Make one swap or add a little liquidity on ${name} each week.`;
    case 'lend':
      return `Adjust the supply or the borrow on ${name} once a week, even by a small amount.`;
    case 'yield':
      return `Top up the vault or claim and re-deposit the yield on ${name} once a week.`;
    case 'deriv':
      return `Rebalance the hedge on ${name} once a week and keep the margin above the minimum.`;
    case 'predict':
      return `Place one fresh position on ${name} each week, on a market that is still open.`;
    case 'rwa':
      return `Check the asset's accrual on ${name} each week and keep the holding in the same wallet.`;
    case 'vault':
      return `Check the vault's allocation on ${name} once a week and keep the shares.`;
    case 'stake':
      return `Check the staking rewards on ${name} once a week and keep the stake untouched.`;
    case 'chain':
      return `Use one app on ${name}'s chain each week, even a small transaction.`;
    case 'insure':
      return `Check the policy on ${name} once a week and keep the cover active.`;
    case 'pay':
      return `Make one payment through ${name} each week, even a small one.`;
    case 'gov':
      return `Vote on one ${name} proposal each week while a vote is open.`;
    case 'card':
      return `Make one purchase with the ${name} card each week.`;
    case 'otc':
      return `Settle one small OTC order on ${name} each week while the book is open.`;
    case 'cedefi':
      return `Check the vault on ${name} once a week and keep the position open.`;
    default:
      return `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`;
  }
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * Nothing here promises a token: the board ranks what a token would be worth if one were issued.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(chain);
  const weeklyGas = Math.max(1, Math.round(gas / 2));
  const hold = holdDaysFor(age);
  const family = familyOf(p.category);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `under $${Math.max(1, gas)} of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: primaryAction(family, p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyAction(family, p),
      cost: `about $${weeklyGas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's form for data.js, with its farm plan attached so the page renders the board's own steps. */
export function radarRow(row: BoardRow, watch: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_value_usd: row.model.base_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    growth_pct: row.model.growth_pct,
    watch,
    farm_steps: row.farm_steps,
  };
}

/**
 * Leave-one-out validation of the model on the snapshot's token-bearing protocols.
 * Each protocol is held out, the power law is refitted without it, and its market
 * cap is predicted from its own TVL, growth and age. The same routine scores
 * two baselines for comparison: a flat global-median multiple, and the
 * starter's flat 0.25x rule with the same growth and maturity adjustments.
 */
export function backtest(snapshot: Snapshot): Validation {
  const live = fittable(snapshot);
  const ratios = live.map((p) => p.mcap_usd! / p.tvl_usd);
  const flat = median(ratios);
  const errors: number[] = [];
  const flatErrors: number[] = [];
  const starterErrors: number[] = [];
  const logErrors: number[] = [];
  let within2 = 0;
  for (const p of live) {
    const others = live.filter((q) => q.slug !== p.slug);
    const law = fitPowerLaw(others);
    const v = impliedValue(p, snapshot.as_of, law);
    const act = p.mcap_usd!;
    errors.push(Math.abs(v.implied - act) / act);
    logErrors.push(Math.abs(Math.log(v.implied / act)));
    if (v.implied / act >= 0.5 && v.implied / act <= 2) within2++;
    flatErrors.push(Math.abs(p.tvl_usd * flat - act) / act);
    // The starter's own rule: a flat 0.25x multiple with the starter's
    // growth and maturity adjustments (maturity 0.60-1.00 over three years).
    const ageForStarter = v.age ?? MODEL_TUNING.unknown_age_days;
    const starterMaturity =
      0.6 + (Math.min(Math.max(ageForStarter, 0), 1095) / 1095) * 0.4;
    const starter = Math.max(1, Math.round(p.tvl_usd * 0.25 * v.growthMult * starterMaturity));
    starterErrors.push(Math.abs(starter - act) / act);
  }
  const mdape = median(errors) * 100;
  return {
    n: live.length,
    median_abs_pct_error: Math.round(mdape * 10) / 10,
    within_2x_pct: Math.round((within2 / Math.max(1, live.length)) * 1000) / 10,
    median_log_error: round4(median(logErrors)),
    typical_factor: round4(Math.exp(median(logErrors))),
    flat_multiple_median_abs_pct_error: Math.round(median(flatErrors) * 1000) / 10,
    starter_rule_median_abs_pct_error: Math.round(median(starterErrors) * 1000) / 10,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData; law: PowerLaw } {
  const law = fitPowerLaw(snapshot.protocols);
  const board = buildBoard(snapshot, law);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    power_law: { intercept: round4(law.intercept), slope: round4(law.slope), fitted_on: law.fitted_on },
    tuning: {
      growth_weight: MODEL_TUNING.growth_weight,
      growth_floor: MODEL_TUNING.growth_floor,
      growth_cap: MODEL_TUNING.growth_cap,
      maturity_floor: MODEL_TUNING.maturity_floor,
      maturity_range: MODEL_TUNING.maturity_range,
      maturity_days: MODEL_TUNING.maturity_days,
      unknown_age_days: MODEL_TUNING.unknown_age_days,
    },
    validation: backtest(snapshot),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar, law };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
