/* ================================================================
   Page Replacement Algorithms — Animated Simulation Engine
   Algorithms: FIFO | LRU | Optimal (OPT) | MFU | LFU
   State machine: IDLE → RUNNING ↔ PAUSED → DONE
   ================================================================ */

// ─── State ───────────────────────────────────────────────────────
const S = {
  algo:   'fifo',
  frames: 3,
  steps:  [],      // all pre-computed steps
  cursor: 0,       // how many steps currently shown
  status: 'idle',  // idle | running | paused | done
  timer:  null,    // setInterval handle
};

// Speed map: slider value → delay ms
const SPEED_MAP = { 1: 900, 2: 520, 3: 300, 4: 160, 5: 60 };

// ─── Algorithm descriptions ───────────────────────────────────────
const ALGO_DESC = {
  fifo: 'First-In First-Out — replaces the page that has been in memory the longest.',
  lru:  'Least Recently Used — replaces the page not accessed for the longest time.',
  opt:  'Optimal — replaces the page not needed for the longest future time (theoretical).',
  mfu:  'Most Frequently Used — evicts the page with the highest access frequency.',
  lfu:  'Least Frequently Used — evicts the page with the lowest access count (LRU tiebreak).',
};

const ALGO_LABELS  = { fifo:'FIFO', lru:'LRU', opt:'OPTIMAL', mfu:'MFU', lfu:'LFU' };
const CARD_ACCENTS = ['#4a9de8','#38bea0','#b464e8','#e88c3c','#e85078'];

// ─── Utilities ────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const el = (tag, cls) => { const e = document.createElement(tag); if(cls) e.className = cls; return e; };

function parseRef(str) {
  return str.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n >= 0);
}
function randomRef() {
  const len  = 12 + Math.floor(Math.random() * 6);
  const pool = 7 + Math.floor(Math.random() * 3);
  const arr  = Array.from({length:len}, () => Math.floor(Math.random() * pool));
  $('ref-input').value = arr.join(' ');
}
function getSpeed() { return SPEED_MAP[+$('speed-slider').value] ?? 520; }

// ─── Algorithms ───────────────────────────────────────────────────
function simulate(algo, refStr, numFrames) {
  const steps = [];
  const mem   = [];          // pages currently in frames
  let   queue = [];          // FIFO / LRU order queue
  const freq  = {};          // page → access count
  const last  = {};          // page → last-used index

  for (let i = 0; i < refStr.length; i++) {
    const page = refStr[i];
    // Update bookkeeping BEFORE eviction decision
    freq[page] = (freq[page] ?? 0) + 1;
    last[page] = i;

    let fault = false, evicted = null, newlyLoaded = false;

    if (mem.includes(page)) {
      // ── HIT ──
      if (algo === 'lru') {
        queue = queue.filter(p => p !== page);
        queue.push(page);
      }
    } else {
      // ── MISS ──
      fault = true;
      if (mem.length < numFrames) {
        mem.push(page);
        queue.push(page);
        newlyLoaded = true;
      } else {
        evicted = pickVictim(algo, mem, freq, last, refStr, i + 1, queue);
        const idx = mem.indexOf(evicted);
        mem[idx]  = page;

        if (algo === 'fifo' || algo === 'lru') {
          queue = queue.filter(p => p !== evicted);
          queue.push(page);
        } else {
          queue = [...mem];
        }
        newlyLoaded = true;
      }
    }

    steps.push({
      page,
      snapshot: [...mem],       // frame state AFTER this reference
      fault,
      evicted,
      newlyLoaded,
      freq: {...freq},
      last: {...last},
    });
  }
  return steps;
}

function pickVictim(algo, mem, freq, last, refStr, fromIdx, queue) {
  if (algo === 'fifo') return queue[0];
  if (algo === 'lru')  return queue[0];
  if (algo === 'opt')  return optVictim(mem, refStr, fromIdx);
  if (algo === 'mfu')  return extremeFreq(mem, freq, last, true);
  if (algo === 'lfu')  return extremeFreq(mem, freq, last, false);
}
function optVictim(mem, refStr, fromIdx) {
  let farthest = -1, victim = mem[0];
  for (const p of mem) {
    const next = refStr.indexOf(p, fromIdx);
    if (next === -1) return p;
    if (next > farthest) { farthest = next; victim = p; }
  }
  return victim;
}
function extremeFreq(mem, freq, last, mostFrequent) {
  let target = mostFrequent ? -Infinity : Infinity;
  let victim = mem[0];
  for (const p of mem) {
    const f = freq[p] ?? 0;
    const beat = mostFrequent ? f > target : f < target;
    const tie  = f === target && (last[p] ?? 0) < (last[victim] ?? 0);
    if (beat || tie) { target = f; victim = p; }
  }
  return victim;
}

// ─── DOM Builders ─────────────────────────────────────────────────
// Build skeleton rows once per simulation setup
function buildSkeleton(refStr, numFrames) {
  const n = refStr.length;

  // Ref track
  const refTrack = $('ref-track');
  refTrack.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const c = el('div', 'cell r-val');
    c.id      = `rc-${i}`;
    c.textContent = refStr[i];
    refTrack.appendChild(c);
  }

  // Frame rows
  const wrap = $('frame-rows-wrap');
  wrap.innerHTML = '';
  for (let f = 0; f < numFrames; f++) {
    const row   = el('div', 'frame-row');
    const lbl   = el('div', 'frame-row-lbl');
    lbl.textContent = `F${f}`;
    const cells = el('div', 'frame-cells');
    cells.id = `fr-${f}`;
    for (let i = 0; i < n; i++) {
      const c = el('div', 'cell');
      c.id    = `fc-${f}-${i}`;
      c.textContent = '—';
      cells.appendChild(c);
    }
    row.appendChild(lbl);
    row.appendChild(cells);
    wrap.appendChild(row);
  }

  // Status track
  const statusTrack = $('status-track');
  statusTrack.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const c = el('div', 'cell');
    c.id = `sc-${i}`;
    c.textContent = '·';
    statusTrack.appendChild(c);
  }
}

// Animate a single step at index `idx`
function animateStep(idx) {
  const step  = S.steps[idx];
  const nF    = S.frames;
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // 1. Highlight current ref cell
  document.querySelectorAll('.cell.cur').forEach(c => c.classList.remove('cur'));
  const refCell = $(`rc-${idx}`);
  if (refCell) refCell.classList.add('cur');

  // Scroll ref cell into view
  if (refCell) refCell.scrollIntoView({ behavior:'smooth', inline:'nearest', block:'nearest' });

  // 2. Update frame cells for this column
  for (let f = 0; f < nF; f++) {
    const cell = $(`fc-${f}-${idx}`);
    if (!cell) continue;
    const page = step.snapshot[f];
    if (page !== undefined) {
      cell.classList.remove('cell');
      cell.className = 'cell f-val cur';
      cell.textContent = page;
      // Was this the newly loaded page?
      if (step.fault && page === step.page) {
        cell.classList.add('pop');
        if (step.evicted !== null) {
          cell.classList.add('anim-fault');
        } else {
          cell.classList.add('anim-fault');
        }
        cell.addEventListener('animationend', () => cell.classList.remove('pop'), { once: true });
      }
    } else {
      cell.textContent = '—';
    }
  }

  // 3. Status cell
  const sc = $(`sc-${idx}`);
  if (sc) {
    sc.classList.remove('cell');
    if (step.fault) {
      sc.className = 'cell is-fault cur anim-fault';
      sc.textContent = 'MISS';
    } else {
      sc.className = 'cell is-hit cur anim-hit';
      sc.textContent = 'HIT';
    }
    sc.scrollIntoView({ behavior:'smooth', inline:'nearest', block:'nearest' });
  }

  // 4. Event badge
  const badge = $('event-badge');
  badge.classList.remove('show','fault','hit');
  void badge.offsetWidth; // reflow to retrigger transition
  if (step.fault) {
    badge.textContent = step.evicted !== null
      ? `PAGE FAULT — evicted ${step.evicted}`
      : `PAGE FAULT — loaded ${step.page}`;
    badge.classList.add('show','fault');
  } else {
    badge.textContent = `PAGE HIT — page ${step.page}`;
    badge.classList.add('show','hit');
  }

  // 5. Live stats
  const shown  = S.steps.slice(0, idx + 1);
  const faults = shown.filter(s => s.fault).length;
  const hits   = (idx + 1) - faults;
  $('stat-step').textContent    = idx + 1;
  $('stat-faults').textContent  = faults;
  $('stat-hits').textContent    = hits;
  $('stat-rate').textContent    = `${((faults/(idx+1))*100).toFixed(1)}%`;
  $('stat-hitrate').textContent = `${((hits/(idx+1))*100).toFixed(1)}%`;

  S.cursor = idx + 1;
}

// ─── Playback controls ────────────────────────────────────────────
function startPlayback(fromCursor = S.cursor) {
  if (S.timer) clearInterval(S.timer);
  S.status = 'running';
  updateBtns();

  S.timer = setInterval(() => {
    if (S.cursor >= S.steps.length) {
      stopPlayback();
      S.status = 'done';
      updateBtns();
      renderComparison();
      return;
    }
    animateStep(S.cursor);
  }, getSpeed());
}
function stopPlayback() {
  clearInterval(S.timer);
  S.timer = null;
}
function pausePlayback() {
  stopPlayback();
  S.status = 'paused';
  updateBtns();
}

function updateBtns() {
  const running = S.status === 'running';
  const active  = S.status === 'running' || S.status === 'paused' || S.status === 'done';
  $('pause-btn').disabled = !active;
  $('pause-btn').textContent = running ? '⏸ PAUSE' : '▶ RESUME';
  $('step-btn').disabled = running || S.status === 'idle';
}

// ─── Full Run ─────────────────────────────────────────────────────
function runSim() {
  const refStr = parseRef($('ref-input').value);
  if (!refStr.length) { alert('Enter a valid reference string (space or comma separated numbers).'); return; }

  // Reset any prior state
  stopPlayback();
  S.algo   = currentAlgo();
  S.frames = frames();
  S.steps  = simulate(S.algo, refStr, S.frames);
  S.cursor = 0;
  S.status = 'running';

  // Show UI
  $('stats-bar').classList.add('visible');
  $('viz-section').classList.add('visible');
  $('compare-section').style.display = 'none';

  // Reset stats display
  $('stat-step').textContent    = '0';
  $('stat-faults').textContent  = '0';
  $('stat-hits').textContent    = '0';
  $('stat-rate').textContent    = '—';
  $('stat-hitrate').textContent = '—';

  // Build DOM skeleton
  buildSkeleton(refStr, S.frames);

  updateBtns();
  startPlayback(0);

  setTimeout(() => $('viz-section').scrollIntoView({ behavior:'smooth', block:'start' }), 150);
}

function resetSim() {
  stopPlayback();
  S.steps  = [];
  S.cursor = 0;
  S.status = 'idle';
  $('stats-bar').classList.remove('visible');
  $('viz-section').classList.remove('visible');
  $('compare-section').style.display = 'none';
  $('ref-track').innerHTML     = '';
  $('frame-rows-wrap').innerHTML = '';
  $('status-track').innerHTML  = '';
  $('event-badge').classList.remove('show','fault','hit');
  updateBtns();
}

// ─── Comparison (all 5 algos) ─────────────────────────────────────
function renderComparison() {
  const refStr = parseRef($('ref-input').value);
  if (!refStr.length) return;
  const numFrames = S.frames;
  const results   = {};
  const ALGOS     = ['fifo','lru','opt','mfu','lfu'];

  for (const a of ALGOS) {
    results[a] = simulate(a, refStr, numFrames).filter(s => s.fault).length;
  }

  const min  = Math.min(...Object.values(results));
  const max  = Math.max(...Object.values(results));
  const grid = $('compare-grid');
  grid.innerHTML = '';

  ALGOS.forEach((a, i) => {
    const f    = results[a];
    const best = f === min;
    const pct  = max > 0 ? (f / max) * 100 : 0;
    const card = el('div', `cmp-card${best ? ' best' : ''}`);
    card.style.setProperty('--card-accent', CARD_ACCENTS[i]);
    card.style.animationDelay = `${i * 55}ms`;
    card.innerHTML = `
      <div class="cmp-algo">${ALGO_LABELS[a]}</div>
      <div class="cmp-faults">${f}</div>
      <div class="cmp-fl">PAGE FAULTS</div>
      <div class="cmp-bar-bg"><div class="cmp-bar" style="width:${pct}%"></div></div>
      ${best ? '<span class="best-badge">★ BEST</span>' : ''}
    `;
    grid.appendChild(card);
  });

  $('compare-section').style.display = '';
  $('compare-section').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ─── Helpers (read DOM state) ─────────────────────────────────────
function currentAlgo() { return document.querySelector('.algo-tab.active')?.dataset.algo ?? 'fifo'; }
function frames()      { return parseInt($('frames-val').textContent, 10) || 3; }

// ─── Event Listeners ─────────────────────────────────────────────
$('run-btn').addEventListener('click', runSim);

$('pause-btn').addEventListener('click', () => {
  if (S.status === 'running') pausePlayback();
  else if (S.status === 'paused' || S.status === 'done') {
    if (S.cursor >= S.steps.length) {
      // restart from beginning
      S.cursor = 0;
      buildSkeleton(parseRef($('ref-input').value), S.frames);
    }
    startPlayback();
  }
});

$('step-btn').addEventListener('click', () => {
  if (S.status === 'idle' || !S.steps.length) return;
  if (S.cursor < S.steps.length) {
    animateStep(S.cursor);
    if (S.cursor >= S.steps.length) {
      S.status = 'done';
      updateBtns();
      renderComparison();
    }
  }
});

$('reset-btn').addEventListener('click', resetSim);

$('random-btn').addEventListener('click', randomRef);

$('ref-input').addEventListener('keydown', e => { if (e.key === 'Enter') runSim(); });

// Algo tabs
document.getElementById('algo-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.algo-tab');
  if (!btn) return;
  document.querySelectorAll('.algo-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  $('algo-desc').textContent = ALGO_DESC[btn.dataset.algo];
  // Re-run if already simulating
  if (S.status !== 'idle') runSim();
});

// Frames stepper
$('frames-inc').addEventListener('click', () => {
  const cur = frames();
  if (cur >= 8) return;
  $('frames-val').textContent = cur + 1;
  if (S.status !== 'idle') runSim();
});
$('frames-dec').addEventListener('click', () => {
  const cur = frames();
  if (cur <= 1) return;
  $('frames-val').textContent = cur - 1;
  if (S.status !== 'idle') runSim();
});

// Speed slider
$('speed-slider').addEventListener('input', () => {
  const v = +$('speed-slider').value;
  const labels = { 1:'0.5×', 2:'1×', 3:'2×', 4:'4×', 5:'MAX' };
  $('speed-label').textContent = labels[v] ?? '1×';
  // If running, restart interval at new speed
  if (S.status === 'running') {
    stopPlayback();
    startPlayback();
  }
});

// ─── Init ─────────────────────────────────────────────────────────
$('algo-desc').textContent = ALGO_DESC['fifo'];
$('frames-val').textContent = '3';
updateBtns();
