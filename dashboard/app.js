// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, filters, and a per-protocol
// detail view with the model's own arithmetic and the protocol's farm plan.
// No network: every byte it shows is in data.js. The farm plan below is the
// same derivation main.ts writes to board.json — category, chains, TVL and
// age in, six concrete steps out — so the page and the board never disagree.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var MODEL = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', tab: 'board', sort: 'implied_value_usd', dir: -1, selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // The model in one function: recompute a row from the snapshot figures and
  // check the number board.json carries, so page and board are visibly the
  // same arithmetic.
  function impliedOf(row) {
    var growth = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * MODEL.growth_weight;
    var age = row.age_days === null ? MODEL.unknown_age_days : row.age_days;
    var maturity = MODEL.maturity_floor + (Math.min(Math.max(age, 0), MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
    return { value: Math.max(1, Math.round(row.tvl_usd * MODEL.base_multiple * growthMult * maturity)), growth: growth, growthMult: growthMult, maturity: maturity, age: age };
  }

  // ---- farm plan (mirrors lib/model.ts farmSteps) ----
  function gasFor(chain) {
    var c = (chain || '').toLowerCase();
    if (c === 'ethereum') return 'about $5';
    if (c === 'solana') return 'under $0.05';
    if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'blast' || c === 'mode' || c === 'zksync era' || c === 'scroll' || c === 'linea') return 'under $0.50';
    if (c === 'bitcoin') return 'about $2';
    if (c === 'tron') return 'about $1';
    return 'about $1';
  }
  function capitalFor(row) {
    if (row.tvl_usd >= 5000000000) return 500;
    if (row.tvl_usd >= 1000000000) return 250;
    if (row.tvl_usd >= 100000000) return 100;
    return 50;
  }
  function holdFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 90;
    if (age < 365) return 60;
    return 45;
  }
  function actionsFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return {
      main: 'Supply $' + capital + ' of USDC as collateral on ' + name + ' (' + chain + ') and borrow $10 of a stablecoin against it, so the position shows both sides of the market.',
      weekly: 'Repay and re-borrow $10, or top up the collateral by $5, to leave a fresh on-chain action.'
    };
    if (c.indexOf('dex') >= 0 || c.indexOf('amm') >= 0 || c.indexOf('swap') >= 0) return {
      main: 'Add $' + capital + ' of liquidity to ' + name + '\'s deepest pool on ' + chain + ' (USDC paired with the pool\'s other asset) and keep the LP receipt.',
      weekly: 'Swap $5 through the pool, or add $5 more liquidity, to keep the wallet active in the pool.'
    };
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return {
      main: 'Deposit $' + capital + ' of USDC into ' + name + '\'s highest-TVL vault on ' + chain + ' and leave the yield compounding.',
      weekly: 'Harvest the vault\'s yield once, and re-deposit at least $5 of it, so the position compounds on-chain.'
    };
    if (c.indexOf('bridge') >= 0 || c.indexOf('canonical') >= 0) return {
      main: 'Bridge $' + capital + ' of USDC into ' + chain + ' through ' + name + ', then use the bridged funds once inside the destination app it serves.',
      weekly: 'Bridge $10 back or across again through ' + name + ', so the wallet shows repeated bridge volume.'
    };
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return {
      main: 'Stake $' + capital + ' of ' + chain + '\'s staking asset through ' + name + ' and hold the liquid receipt token it issues.',
      weekly: 'Restake the staking rewards, or stake another $5, to grow the staked balance.'
    };
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return {
      main: 'Deposit $' + capital + ' of USDC as margin on ' + name + ' (' + chain + ') and open one small hedged position, sized under $25 notional.',
      weekly: 'Close the hedge and open a fresh one under $25 notional, keeping the margin deposited.'
    };
    if (c.indexOf('prediction') >= 0) return {
      main: 'Fund $' + capital + ' on ' + name + ' and take one position in its most liquid market, sized under $25.',
      weekly: 'Settle the position and take one new position under $25 in a different market.'
    };
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) return {
      main: 'Deposit $' + capital + ' of USDC into a ' + name + ' vault on ' + chain + ' and hold the vault shares it issues.',
      weekly: 'Top up the vault by $5, or move the shares into the vault\'s newest strategy when it opens.'
    };
    if (c.indexOf('stable') >= 0) return {
      main: 'Mint $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' against USDC collateral, and hold the minted balance.',
      weekly: 'Mint or redeem $10 of the stable asset to leave a fresh minting action on record.'
    };
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) return {
      main: 'Mint $' + capital + ' of ' + name + '\'s yield-bearing asset on ' + chain + ' and hold it in the farm wallet.',
      weekly: 'Claim the asset\'s accrued yield, or mint another $5 of it, to show continued holding.'
    };
    if (c.indexOf('insurance') >= 0) return {
      main: 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' for a protocol you already use, and keep the policy active.',
      weekly: 'Extend the cover by $5, or file a no-claim check-in on the policy page.'
    };
    if (c.indexOf('governance') >= 0) return {
      main: 'Lock $' + capital + ' of the governance asset ' + name + ' supports on ' + chain + ' and delegate the voting power to an active delegate.',
      weekly: 'Vote on one live proposal, or re-delegate if the delegate goes quiet.'
    };
    if (c.indexOf('payment') >= 0) return {
      main: 'Route $' + capital + ' of USDC through ' + name + ' on ' + chain + ' to a wallet you control, completing one real payment.',
      weekly: 'Route another $10 payment through ' + name + ' to keep the payment history active.'
    };
    if (c.indexOf('basis') >= 0) return {
      main: 'Deposit $' + capital + ' of USDC into ' + name + '\'s basis vault on ' + chain + ' and hold the vault shares.',
      weekly: 'Top up the vault by $5, or claim and re-deposit the funding-rate yield.'
    };
    return {
      main: 'Deposit $' + capital + ' of USDC into ' + name + '\'s main product on ' + chain + ' and keep the position open.',
      weekly: 'Repeat the protocol\'s core action once with $5, such as a deposit, a swap or a vote.'
    };
  }
  function farmSteps(row) {
    var chain = row.chains && row.chains.length ? row.chains[0] : 'its main chain';
    var capital = capitalFor(row);
    var hold = holdFor(row.age_days);
    var gas = gasFor(chain);
    var acts = actionsFor(row, capital, chain);
    var steps = [
      { text: 'Open a fresh wallet that holds only the funds you plan to farm, write its seed phrase on paper and keep it offline, then fund it with $' + (capital + 20) + ' of USDC on ' + chain + '.', cost: gas + ' of gas for the funding transfer', time: '10 minutes' },
      { text: acts.main, cost: '$' + capital + ' of capital and ' + gas + ' of gas', time: '15 minutes to set up' },
      { text: 'Once a week, do one qualifying action. ' + acts.weekly, cost: gas + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days, through more than one snapshot, instead of depositing and withdrawing in the same week.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page from the link its official site publishes, and claim only there. Never pay a fee to claim, and never connect the wallet to a link from a chat or a search ad.', cost: 'no fee to check', time: '10 minutes' },
      { text: 'Write the wallet address, the dates and every transaction hash in a farm log, so you can repeat the position on the next protocol or unwind this one without guessing.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    return steps.map(function (s) {
      var out = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.';
      return out.length > 600 ? out.slice(0, 596) + '...' : out;
    });
  }

  // ---- rendering ----
  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('rows'), detailEl = $('detail');

  function fillSelect(sel, values, label) {
    var html = '<option value="all">' + label + '</option>';
    values.forEach(function (v) { html += '<option value="' + esc(v) + '">' + esc(v) + '</option>'; });
    sel.innerHTML = html;
  }
  function initFilters() {
    var cats = [], chains = [];
    DATA.rows.forEach(function (r) {
      if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
      (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
    });
    cats.sort(); chains.sort();
    fillSelect($('cat'), cats, 'All categories');
    fillSelect($('chain'), chains, 'All chains');
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var list = state.tab === 'live' ? DATA.live.slice() : DATA.rows.slice();
    return list.filter(function (r) {
      if (state.tab === 'board') {
        if (state.category !== 'all' && r.category !== state.category) return false;
        if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      }
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sortKey(r, key) {
    if (key === 'name') return r.name.toLowerCase();
    if (key === 'category') return (r.category || '').toLowerCase();
    if (key === 'chains') return (r.chains && r.chains[0]) || '';
    if (key === 'age_days') return r.age_days === null ? -1 : r.age_days;
    if (key === 'change_7d') return r.change_7d === null ? -9999 : r.change_7d;
    return r[key] === null || r[key] === undefined ? -1 : r[key];
  }
  function sortedRows(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var x = sortKey(a, key), y = sortKey(b, key);
      if (x < y) return -1 * dir;
      if (x > y) return 1 * dir;
      return (a.rank || 0) - (b.rank || 0);
    });
  }

  function renderTable() {
    var list = sortedRows(filteredRows());
    var live = state.tab === 'live';
    $('count').textContent = live
      ? list.length + ' of ' + DATA.live.length + ' tokens already trading — shown at market value, not a model claim.'
      : list.length + ' of ' + DATA.rows.length + ' pre-token protocols · ' + DATA.watchlist_size + ' on the watchlist · ' + DATA.early_size + ' found below the floor.';
    var html = '';
    list.forEach(function (r) {
      var pct = r.change_7d === null ? '<span>n/a</span>' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change_7d) + '</span>';
      var val = live
        ? '<span class="val">' + fmtUsd(r.mcap_usd) + '</span>'
        : '<span class="val">' + fmtUsd(r.implied_value_usd) + '</span>';
      var rankCell = live ? '—' : r.rank;
      html += '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + rankCell + '</td>' +
        '<td class="name"><b>' + esc(r.name) + '</b><span>' + esc(r.slug) + '</span></td>' +
        '<td><span class="pill">' + esc(r.category || '—') + '</span></td>' +
        '<td>' + esc((r.chains || []).slice(0, 1).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num">' + val + '</td></tr>';
    });
    rowsEl.innerHTML = html || '<tr><td colspan="8">No protocols match this filter.</td></tr>';
    document.querySelectorAll('#board th').forEach(function (th) {
      var k = th.getAttribute('data-sort');
      th.textContent = th.textContent.replace(/ [▲▼]$/, '') + (state.sort === k ? (state.dir === -1 ? ' ▼' : ' ▲') : '');
    });
  }

  function renderDetail() {
    if (!state.selected) { detailEl.hidden = true; detailEl.innerHTML = ''; return; }
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
    if (!row) { DATA.live.forEach(function (r) { if (r.slug === state.selected) row = r; }); }
    if (!row) { detailEl.hidden = true; return; }
    var live = row.implied_value_usd === undefined;
    var html = '<button class="close" id="detail-close">Close ✕</button>';
    html += '<h2>' + esc(row.name) + '</h2>';
    html += '<p class="sub">' + esc(row.slug) + ' · ' + esc(row.category || 'no category') + ' · ' + esc((row.chains || []).join(', ') || '—') + '</p>';
    if (live) {
      html += '<div class="grid">' +
        '<div class="cell"><span>Market cap</span><b>' + fmtUsd(row.mcap_usd) + '</b></div>' +
        '<div class="cell"><span>TVL</span><b>' + fmtUsd(row.tvl_usd) + '</b></div>' +
        '<div class="cell"><span>7-day TVL</span><b>' + fmtPct(row.change_7d) + '</b></div></div>' +
        '<p class="note">This token already trades, so the board shows the market\u2019s own value for it and never ranks it against the pre-token protocols. Its farm plan is the same derivation, for readers who still want to use the protocol.</p>';
    } else {
      var m = impliedOf(row);
      var match = m.value === row.implied_value_usd;
      html += '<div class="grid">' +
        '<div class="cell"><span>Rank</span><b>#' + row.rank + '</b></div>' +
        '<div class="cell"><span>Implied value</span><b>' + fmtUsd(row.implied_value_usd) + '</b></div>' +
        '<div class="cell"><span>TVL</span><b>' + fmtUsd(row.tvl_usd) + '</b></div>' +
        '<div class="cell"><span>7-day TVL</span><b>' + fmtPct(row.change_7d) + '</b></div>' +
        '<div class="cell"><span>Age, no token</span><b>' + fmtAge(row.age_days) + '</b></div>' +
        '<div class="cell"><span>Base × 0.30</span><b>' + fmtUsd(Math.round(row.tvl_usd * MODEL.base_multiple)) + '</b></div>' +
        '<div class="cell"><span>Growth ×</span><b>' + m.growthMult.toFixed(2) + '</b></div>' +
        '<div class="cell"><span>Maturity ×</span><b>' + m.maturity.toFixed(2) + '</b></div></div>' +
        '<p class="note">Model check: TVL × 0.30 × ' + m.growthMult.toFixed(2) + ' × ' + m.maturity.toFixed(2) + ' = ' + fmtUsd(m.value) +
        (match ? ' — matches the board.' : ' — differs from the board\u2019s ' + fmtUsd(row.implied_value_usd) + '.') +
        ' Growth is the 7-day change clamped to ' + MODEL.growth_floor + '%…+' + MODEL.growth_cap + '%; maturity is 0.55 + age up to 4 years / 0.45.</p>';
    }
    html += '<h3>Farm plan — six steps</h3><ol>';
    farmSteps(row).forEach(function (s) { html += '<li>' + esc(s) + '</li>'; });
    html += '</ol>';
    detailEl.innerHTML = html;
    detailEl.hidden = false;
    var close = $('detail-close');
    if (close) close.addEventListener('click', function () { select(null); });
  }

  function renderAll() { renderTable(); renderDetail(); syncHash(); }

  // ---- hash deep-links: #tab=board|live #q=.. #cat=.. #chain=.. #detail=slug #sort=key:dir ----
  function syncHash() {
    var parts = [];
    if (state.tab !== 'board') parts.push('tab=' + state.tab);
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('cat=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.sort !== 'implied_value_usd' || state.dir !== -1) parts.push('sort=' + state.sort + ':' + state.dir);
    if (state.selected) parts.push('detail=' + encodeURIComponent(state.selected));
    var h = parts.join('&');
    if (('' + location.hash.slice(1)) !== h) history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }
  function readHash() {
    // A hash is the whole state: reset first so a hash change never carries
    // a stale selection or filter from the previous hash.
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.tab = 'board'; state.selected = null;
    state.sort = 'implied_value_usd'; state.dir = -1;
    var params = new URLSearchParams(location.hash.slice(1));
    if (params.get('tab') === 'live') state.tab = 'live';
    if (params.get('q')) state.q = params.get('q');
    if (params.get('cat')) state.category = params.get('cat');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('detail')) state.selected = params.get('detail');
    var s = params.get('sort');
    if (s) { var kv = s.split(':'); state.sort = kv[0]; state.dir = kv[1] === '1' ? 1 : -1; }
  }

  function applyStateToControls() {
    $('q').value = state.q;
    $('cat').value = state.category;
    $('chain').value = state.chain;
    $('tab-board').setAttribute('aria-selected', state.tab === 'board' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
  }

  function select(slug) {
    state.selected = slug;
    renderAll();
    if (slug) detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setTab(tab) {
    state.tab = tab;
    state.selected = null;
    $('tab-board').setAttribute('aria-selected', tab === 'board' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-selected', tab === 'live' ? 'true' : 'false');
    renderAll();
  }

  // ---- wire up ----
  $('lede').innerHTML = 'Snapshot <b>' + esc(DATA.as_of) + '</b> · <b>' + DATA.rows.length + '</b> pre-token protocols ranked · <b>' +
    DATA.watchlist_size + '</b> on the watchlist (TVL ≥ $50M, no token recorded) · <b>' + DATA.early_size +
    '</b> found below the floor. Tokens that already trade sit apart, at market value.';
  $('model-line').textContent = 'implied = TVL × ' + MODEL.base_multiple + ' × (1 + clamp(7d, ' + MODEL.growth_floor + '%, +' + MODEL.growth_cap + '%) × ' + MODEL.growth_weight + ') × (0.55 + age≤4y × 0.45) · model ' + DATA.model_version;
  $('source-line').textContent = 'Source: ' + DATA.source + ' · floor $' + DATA.floor_usd.toLocaleString('en-US') + ' · snapshot ' + DATA.as_of + '.';
  initFilters();
  readHash();
  applyStateToControls();
  renderAll();
  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderAll(); });
  $('cat').addEventListener('change', function (e) { state.category = e.target.value; renderAll(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderAll(); });
  $('tab-board').addEventListener('click', function () { setTab('board'); });
  $('tab-live').addEventListener('click', function () { setTab('live'); });
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' || k === 'category' || k === 'chains' ? 1 : -1; }
      renderAll();
    });
  });
  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) select(tr.getAttribute('data-slug') === state.selected ? null : tr.getAttribute('data-slug'));
  });
  window.addEventListener('hashchange', function () { readHash(); applyStateToControls(); renderAll(); });
})();
