// Token Launch Radar — dashboard logic (no framework, no network).
// Reads window.RADAR from data.js, renders the board, the filters, the
// detail view and the live-token table. The farm steps shown are the board's
// own steps, carried in the data, so the page and board.json always agree.

(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.getElementById('meta').textContent = 'No data: data.js did not load.'; return; }

  var WATCH = {};
  D.rows.forEach(function (r) { if (r.watch) WATCH[r.slug] = true; });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(abs >= 1e11 ? 0 : 2).replace(/\.00$/, '') + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(abs >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n == null) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n > 0 ? 'pos' : n < 0 ? 'neg' : '') + '">' + s + '</span>';
  }
  function age(n) { return n == null ? '—' : n + 'd'; }
  function chains(r) { return r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') : '—'; }

  // ---- header, stats, methodology
  document.getElementById('meta').textContent =
    'Snapshot ' + D.as_of + ' · ' + D.board_size + ' pre-token protocols ranked · model ' + D.model_version +
    ' · values in US dollars · a protocol is pre-token because the snapshot records no token for it';
  var top = D.rows[0];
  document.getElementById('stats').innerHTML = [
    '<span class="chip"><b>' + D.board_size + '</b> ranked</span>',
    '<span class="chip"><b>' + D.watchlist_size + '</b> watchlist covered</span>',
    '<span class="chip"><b>' + D.early_size + '</b> early finds below the floor</span>',
    '<span class="chip"><b>' + D.live_size + '</b> live tokens set aside</span>',
    '<span class="chip">Top implied value <b>' + money(top ? top.implied_value_usd : 0) + '</b></span>'
  ].join('');

  var m = document.getElementById('method');
  m.innerHTML =
    '<p><b>Value model (' + esc(D.model_version) + ').</b> The implied value is fitted to the snapshot itself: ' +
    'a power law in log space, <code>ln(market cap) = ' + D.power_law.intercept + ' + ' + D.power_law.slope +
    ' × ln(TVL)</code>, fitted by least squares over the ' + D.power_law.fitted_on +
    ' token-bearing protocols that carry a market cap. A flat multiple assumes value scales one-for-one with size; ' +
    'the snapshot says it grows closer to the square root of size. Each protocol is then adjusted by its own ' +
    'seven-day TVL growth (clamped to −60%…+120%, half weight) and by how long it has run with no token recorded ' +
    '(0.85–1.00 over three years). No protocol name is ever special-cased.</p>' +
    '<p><b>Validation.</b> Leave-one-out backtest on the same ' + D.validation.n + ' token-bearing protocols: ' +
    'median absolute error <b>' + D.validation.median_abs_pct_error + '%</b> (typical factor ' + D.validation.typical_factor +
    '×), <b>' + D.validation.within_2x_pct + '%</b> of predictions within 2× of the true market cap. ' +
    'A flat global-median multiple scores ' + D.validation.flat_multiple_median_abs_pct_error + '% median error and the ' +
    'starter flat 0.25× rule scores ' + D.validation.starter_rule_median_abs_pct_error + '%. The power law wins on every ' +
    'metric — and the spread is real: TVL alone predicts a market cap only weakly, so implied values are an ' +
    'order-of-magnitude ranking, not price targets.</p>' +
    '<p><b>What gets ranked.</b> The snapshot\u2019s watchlist (TVL $50M+, no token recorded, not a wrapped, staked or ' +
    'bridged product) is the floor, never the ceiling: the board adds every other standalone pre-token protocol, ' +
    'above or below the floor. Left out are exchanges, bridges, liquid-staking and restaking products, stablecoin ' +
    'wrappers, versioned pools (V2, 2.0, …) and names carrying wrapped, staked or staking — products of a token ' +
    'that already trades, not launches of their own. Protocols whose token already trades appear below, priced by ' +
    'the market, never ranked as pre-token.</p>' +
    '<p><b>Farm plans.</b> Six steps per protocol, built from its own category, chains, TVL and age: the action fits ' +
    'what that kind of protocol does (a DEX gets a swap and liquidity, a lender gets a supply and a borrow), each ' +
    'with what it costs in gas and capital and how long it takes. Nothing here promises a token.</p>';

  // ---- filters
  var qEl = document.getElementById('q');
  var catEl = document.getElementById('cat');
  var chainEl = document.getElementById('chain');
  var minEl = document.getElementById('mintvl');
  var watchEl = document.getElementById('watchonly');
  var state = { sort: 'rank', dir: 1, open: null };

  var cats = {};
  var chs = {};
  D.rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    (r.chains || []).forEach(function (c) { chs[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; catEl.appendChild(o);
  });
  Object.keys(chs).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; chainEl.appendChild(o);
  });

  function filtered() {
    var q = qEl.value.trim().toLowerCase();
    var cat = catEl.value;
    var ch = chainEl.value;
    var min = Number(minEl.value);
    var wo = watchEl.checked;
    return D.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (ch && !(r.chains || []).includes(ch)) return false;
      if (min && r.tvl_usd < min) return false;
      if (wo && !WATCH[r.slug]) return false;
      return true;
    });
  }

  function sorted(rows) {
    var k = state.sort, d = state.dir;
    return rows.slice().sort(function (a, b) {
      var av = a[k], bv = b[k];
      if (k === 'name' || k === 'category') {
        av = (av || '').toLowerCase(); bv = (bv || '').toLowerCase();
        return av < bv ? -d : av > bv ? d : 0;
      }
      if (k === 'chains') { av = (a.chains || []).length; bv = (b.chains || []).length; }
      av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv;
      return (av - bv) * d || (a.rank - b.rank);
    });
  }

  var tbody = document.getElementById('rows');
  function render() {
    var rows = sorted(filtered());
    document.getElementById('count').textContent =
      rows.length + ' of ' + D.rows.length + ' protocols' + (rows.length !== D.rows.length ? ' match the filters' : '');
    tbody.innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.open === r.slug ? ' class="active"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' +
        (WATCH[r.slug] ? '<span class="badge watch">WATCHLIST</span>' : '<span class="badge early">EARLY</span>') +
        '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(chains(r)) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
    }).join('') || '<tr><td colspan="8" class="muted">No protocol matches these filters.</td></tr>';
    document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === state.sort);
      th.textContent = th.textContent.replace(/ [▲▼]$/, '') + (th.getAttribute('data-sort') === state.sort ? (state.dir === 1 ? ' ▲' : ' ▼') : '');
    });
  }

  document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = (k === 'rank' || k === 'name' || k === 'category') ? 1 : -1; }
      render();
    });
  });
  [qEl, catEl, chainEl, minEl, watchEl].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });
  document.getElementById('reset').addEventListener('click', function () {
    qEl.value = ''; catEl.value = ''; chainEl.value = ''; minEl.value = '0'; watchEl.checked = false;
    render();
  });

  // ---- detail view
  var detail = document.getElementById('detail');
  function openDetail(slug, scroll) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    state.open = slug;
    document.getElementById('d-badge').textContent = WATCH[slug] ? 'WATCHLIST · RANK #' + r.rank : 'EARLY FIND · RANK #' + r.rank;
    document.getElementById('d-name').textContent = r.name;
    document.getElementById('d-sub').textContent =
      (r.category || 'Uncategorised') + ' · ' + (r.chains || []).join(', ') + ' · snapshot ' + D.as_of;
    document.getElementById('d-stats').innerHTML = [
      ['TVL', money(r.tvl_usd)],
      ['7-day TVL change', r.change_7d == null ? 'not reported' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(2) + '%'],
      ['Age (tracked)', r.age_days == null ? 'not reported' : r.age_days + ' days'],
      ['Implied value', money(r.implied_value_usd)]
    ].map(function (c) { return '<div class="cell"><div class="k">' + c[0] + '</div><div class="v">' + esc(c[1]) + '</div></div>'; }).join('');
    var g = r.growth_pct == null ? 0 : r.growth_pct;
    document.getElementById('d-formula').innerHTML = [
      '<li><b>Base from size.</b> <code>exp(' + D.power_law.intercept + ' + ' + D.power_law.slope + ' × ln(' + money(r.tvl_usd) + ')) = ' + money(r.base_value_usd) + '</code> — the power law fitted on the snapshot\u2019s ' + D.power_law.fitted_on + ' live protocols.</li>',
      '<li><b>Growth.</b> 7-day change ' + (r.change_7d == null ? 'not reported (0%)' : r.change_7d.toFixed(2) + '%') + ' is clamped to −60%…+120% and half-weighted: multiplier <code>×' + r.growth_multiplier.toFixed(2) + '</code>.</li>',
      '<li><b>Maturity.</b> Tracked ' + (r.age_days == null ? 'for an unknown time (365 days assumed)' : r.age_days + ' days') + ': multiplier <code>×' + r.maturity_multiplier.toFixed(2) + '</code>.</li>',
      '<li><b>Implied value.</b> <code>' + money(r.base_value_usd) + ' × ' + r.growth_multiplier.toFixed(2) + ' × ' + r.maturity_multiplier.toFixed(2) + ' = ' + money(r.implied_value_usd) + '</code>.</li>'
    ].join('');
    document.getElementById('d-note').textContent =
      'What this is: the value a token would carry if one were issued and the protocol\u2019s record stayed as it is. The snapshot records no token for ' + r.name + ' — it does not prove there is none.';
    document.getElementById('d-steps').innerHTML = (r.farm_steps || []).map(function (s) {
      var m2 = s.match(/^(.*?) Cost: (.*?) Time: (.*?)\.?$/);
      if (!m2) return '<li>' + esc(s) + '</li>';
      return '<li>' + esc(m2[1]) + '<br><span class="cost">Cost: ' + esc(m2[2]) + ' · Time: ' + esc(m2[3]) + '</span></li>';
    }).join('');
    detail.hidden = false;
    render();
    if (scroll) detail.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (location.hash !== '#detail=' + slug) history.replaceState(null, '', '#detail=' + slug);
  }
  function closeDetail() {
    state.open = null;
    detail.hidden = true;
    render();
    history.replaceState(null, '', location.pathname + location.search);
  }
  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'), true);
  });
  document.getElementById('d-close').addEventListener('click', closeDetail);

  // ---- live table
  document.getElementById('live-rows').innerHTML = D.live.map(function (p) {
    return '<tr><td><span class="name">' + esc(p.name) + '</span><br><span class="slug">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num"><b>' + money(p.mcap_usd) + '</b></td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- hash routing (board, detail and filtered screenshots use it)
  function fromHash() {
    var h = location.hash.replace(/^#/, '');
    var parts = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) parts[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    if (parts.cat) catEl.value = parts.cat;
    if (parts.chain) chainEl.value = parts.chain;
    if (parts.q) qEl.value = parts.q;
    if (parts.watch) watchEl.checked = parts.watch === '1';
    if (parts.min) minEl.value = parts.min;
    render();
    if (parts.detail) openDetail(parts.detail, true);
    else if (state.open) { state.open = null; detail.hidden = true; render(); }
  }
  window.addEventListener('hashchange', fromHash);

  render();
  fromHash();
})();
