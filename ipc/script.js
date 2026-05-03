const S = {
  status: 'idle',
  timer: null,
  steps: [],
  cursor: 0,
  mechanism: 'shared-memory',
  bufferSize: 6,
  producerCount: 2,
  consumerCount: 2,
  totalItems: 12,
  speed: 2,
};

const SPEED_MAP = { 1: 900, 2: 520, 3: 300, 4: 160, 5: 60 };

const MECHANISMS = {
  'shared-memory': {
    label: 'Shared Memory',
    desc: 'Direct memory access shared between processes. Fastest IPC — zero kernel involvement per transfer.',
    compare: 'Shared Memory',
    accent: '#4a9de8',
    cost: 1,
  },
  'message-queue': {
    label: 'Message Queue',
    desc: 'Kernel-buffered FIFO messages with explicit enqueue and dequeue handoff.',
    compare: 'Message Queue',
    accent: '#b464e8',
    cost: 1.28,
  },
  pipe: {
    label: 'Pipe',
    desc: 'Sequential FIFO byte stream with explicit write and read transfer stages.',
    compare: 'Pipe',
    accent: '#e88c3c',
    cost: 1.42,
  },
};

const $ = (id) => document.getElementById(id);
const DOM = {
  processList: $('process-list'),
  bufferCells: $('buffer-cells'),
  bufferStage: $('buffer-stage'),
  semList: $('sem-list'),
  eventLog: $('event-log'),
  compareGrid: $('compare-grid'),
  bufHeader: $('buf-header'),
  bufTop: $('buf-status-top'),
  bufBottom: $('buf-status-bot'),
  inPointer: $('in-pointer'),
  outPointer: $('out-pointer'),
  statsBar: $('stats-bar'),
  vizSection: $('viz-section'),
  compareSection: $('compare-section'),
  mechDesc: $('mech-desc'),
  mechTabs: document.querySelectorAll('.mech-tab'),
  speedLabel: $('speed-label'),
  speedSlider: $('speed-slider'),
  buttons: {
    run: $('run-btn'),
    pause: $('pause-btn'),
    step: $('step-btn'),
    reset: $('reset-btn'),
  },
  inputs: {
    buf: { val: $('buf-val'), dec: $('buf-dec'), inc: $('buf-inc') },
    prod: { val: $('prod-val'), dec: $('prod-dec'), inc: $('prod-inc') },
    cons: { val: $('cons-val'), dec: $('cons-dec'), inc: $('cons-inc') },
    items: { val: $('items-val'), dec: $('items-dec'), inc: $('items-inc') },
  },
  stats: {
    step: $('stat-step'),
    produced: $('stat-produced'),
    consumed: $('stat-consumed'),
    blocked: $('stat-blocked'),
    deadlock: $('stat-deadlock'),
  },
};

const PROCESS_META = new Map();
const SEM_HISTORY = { mutex: [], empty: [], full: [] };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatClock(totalMs) {
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `00:${minutes}:${seconds}`;
}

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function distribute(total, parts) {
  const base = Math.floor(total / parts);
  const extra = total % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < extra ? 1 : 0));
}

function currentParams() {
  return {
    bufferSize: S.bufferSize,
    producerCount: S.producerCount,
    consumerCount: S.consumerCount,
    totalItems: S.totalItems,
  };
}

function currentDelay() {
  return SPEED_MAP[S.speed] ?? SPEED_MAP[2];
}

function refreshConfigLabels() {
  DOM.inputs.buf.val.textContent = String(S.bufferSize);
  DOM.inputs.prod.val.textContent = String(S.producerCount);
  DOM.inputs.cons.val.textContent = String(S.consumerCount);
  DOM.inputs.items.val.textContent = String(S.totalItems);
  DOM.speedLabel.textContent = `${S.speed}×`;
  DOM.mechDesc.textContent = MECHANISMS[S.mechanism].desc;
  DOM.mechTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mech === S.mechanism));
}

function updateConfigValue(key, delta, min, max) {
  S[key] = clamp(S[key] + delta, min, max);
  refreshConfigLabels();
}

function clearTimers() {
  if (S.timer) {
    clearInterval(S.timer);
    S.timer = null;
  }
}

function setControls() {
  const running = S.status === 'running';
  const active = S.status === 'running' || S.status === 'paused' || S.status === 'done';
  DOM.buttons.run.textContent = S.status === 'paused' ? '▶ RESUME' : '▶ RUN';
  DOM.buttons.pause.disabled = !active;
  DOM.buttons.pause.textContent = running ? '⏸ PAUSE' : '⏯ WAIT';
  DOM.buttons.step.disabled = running;
  DOM.buttons.reset.disabled = false;
}

function initProcesses() {
  const processes = [];
  const shares = distribute(S.totalItems, S.producerCount);
  for (let index = 0; index < S.producerCount; index += 1) {
    processes.push({
      pid: `P${index}`,
      type: 'producer',
      state: 'WAITING',
      phase: 0,
      blockedOn: null,
      produced: 0,
      consumed: 0,
      quota: shares[index],
      log: [],
      done: false,
    });
  }
  for (let index = 0; index < S.consumerCount; index += 1) {
    processes.push({
      pid: `C${index}`,
      type: 'consumer',
      state: 'WAITING',
      phase: 0,
      blockedOn: null,
      produced: 0,
      consumed: 0,
      quota: S.totalItems,
      log: [],
      done: false,
    });
  }
  return processes;
}

function processPayloadSnapshot(processes) {
  const payload = {};
  processes.forEach((proc) => {
    payload[proc.pid] = {
      produced: proc.produced,
      consumed: proc.consumed,
      quota: proc.quota,
    };
  });
  return payload;
}

function simulate(params) {
  const processes = initProcesses();
  const buffer = Array.from({ length: params.bufferSize }, () => null);
  const waitingOn = { mutex: [], empty: [], full: [] };
  const sem = { mutex: 1, empty: params.bufferSize, full: 0, inPointer: 0, outPointer: 0 };
  const steps = [];
  let produced = 0;
  let consumed = 0;
  let rrCursor = 0;
  let clock = 0;
  let deadlock = false;
  let itemCounter = 1;

  function emit(step) {
    steps.push({
      stepNum: steps.length + 1,
      timestamp: formatClock(clock),
      processId: step.processId,
      processType: step.processType,
      action: step.action,
      semaphore: step.semaphore ?? null,
      itemId: step.itemId ?? null,
      bufferSnapshot: [...buffer],
      inPointer: sem.inPointer,
      outPointer: sem.outPointer,
      semaphoreSnapshot: { mutex: sem.mutex, empty: sem.empty, full: sem.full },
      processStates: Object.fromEntries(processes.map((proc) => [proc.pid, proc.state])),
      waitingOn: {
        mutex: [...waitingOn.mutex],
        empty: [...waitingOn.empty],
        full: [...waitingOn.full],
      },
      processProgress: processPayloadSnapshot(processes),
      produced,
      consumed,
      blockedCount: processes.filter((proc) => proc.state === 'BLOCKED').length,
      logMessage: step.logMessage,
      eventType: step.eventType,
      mechanismLabel: step.mechanismLabel,
      activeSlot: step.activeSlot ?? null,
    });
    clock += 240;
  }

  function queueFor(semName) {
    return waitingOn[semName];
  }

  function blockOn(proc, semName, logMessage) {
    if (!queueFor(semName).includes(proc.pid)) {
      queueFor(semName).push(proc.pid);
    }
    proc.state = 'BLOCKED';
    proc.blockedOn = semName;
    emit({
      processId: proc.pid,
      processType: proc.type,
      action: 'blocked',
      semaphore: semName,
      logMessage,
      eventType: 'block',
    });
  }

  function unblockOne(semName) {
    const pid = queueFor(semName).shift();
    if (!pid) return;
    const proc = processes.find((entry) => entry.pid === pid);
    if (!proc) return;
    proc.state = 'WAITING';
    proc.blockedOn = null;
    proc.phase += 1;
    emit({
      processId: proc.pid,
      processType: proc.type,
      action: 'unblocked',
      semaphore: semName,
      logMessage: `${proc.pid} unblocked from ${semName} and resumes`,
      eventType: 'unblock',
    });
  }

  function waitSem(proc, semName) {
    if (sem[semName] === 0) {
      blockOn(proc, semName, `${proc.pid} blocked on ${semName}`);
      return false;
    }
    sem[semName] -= 1;
    proc.phase += 1;
    emit({
      processId: proc.pid,
      processType: proc.type,
      action: 'wait',
      semaphore: semName,
      logMessage: `${proc.pid} wait(${semName}) -> acquired`,
      eventType: 'wait',
    });
    return true;
  }

  function signalSem(proc, semName) {
    if (queueFor(semName).length > 0) {
      sem[semName] = 0;
    } else {
      sem[semName] += 1;
    }
    proc.phase += 1;
    emit({
      processId: proc.pid,
      processType: proc.type,
      action: 'signal',
      semaphore: semName,
      logMessage: `${proc.pid} signal(${semName})`,
      eventType: 'signal',
    });
    if (queueFor(semName).length > 0) {
      unblockOne(semName);
    }
  }

  function mechanismAction(proc, itemId, mode) {
    const mech = params.mechanism;
    if (mech === 'message-queue') {
      const action = mode === 'produce' ? 'enqueue' : 'dequeue';
      emit({
        processId: proc.pid,
        processType: proc.type,
        action,
        itemId,
        mechanismLabel: action,
        logMessage: `${proc.pid} ${action} item_${itemId} in kernel buffer`,
        eventType: mode,
      });
      emit({
        processId: proc.pid,
        processType: proc.type,
        action: 'kernel-buffer',
        itemId,
        mechanismLabel: 'kernel buffer',
        logMessage: `kernel buffer mediates item_${itemId}`,
        eventType: mode,
      });
      return;
    }

    if (mech === 'pipe') {
      const action = mode === 'produce' ? 'write(pipe)' : 'read(pipe)';
      emit({
        processId: proc.pid,
        processType: proc.type,
        action,
        itemId,
        mechanismLabel: action,
        logMessage: `${proc.pid} ${action} item_${itemId}`,
        eventType: mode,
      });
    }
  }

  function produceTurn(proc) {
    if (proc.done) return;
    proc.state = 'RUNNING';
    if (!waitSem(proc, 'empty')) return;
    if (!waitSem(proc, 'mutex')) return;

    const itemId = itemCounter;
    const slot = sem.inPointer;
    mechanismAction(proc, itemId, 'produce');
    buffer[slot] = itemId;
    sem.inPointer = (sem.inPointer + 1) % params.bufferSize;
    produced += 1;
    proc.produced += 1;
    proc.log.unshift(`produced item_${itemId}`);
    proc.log = proc.log.slice(0, 3);
    emit({
      processId: proc.pid,
      processType: proc.type,
      action: 'produce',
      itemId,
      activeSlot: slot,
      mechanismLabel: params.mechanism === 'pipe' ? 'write' : params.mechanism === 'message-queue' ? 'enqueue' : 'produce',
      logMessage: `${proc.pid} produced item_${itemId} into slot ${slot}`,
      eventType: 'produce',
    });
    itemCounter += 1;
    signalSem(proc, 'mutex');
    signalSem(proc, 'full');

    if (proc.produced >= proc.quota) {
      proc.done = true;
      proc.state = 'DONE';
      proc.log.unshift('producer quota complete');
      proc.log = proc.log.slice(0, 3);
      emit({
        processId: proc.pid,
        processType: proc.type,
        action: 'done',
        logMessage: `${proc.pid} completed producer quota`,
        eventType: 'signal',
      });
    } else {
      proc.phase = 0;
      proc.state = 'WAITING';
    }
  }

  function consumeTurn(proc) {
    if (proc.done) return;
    proc.state = 'RUNNING';
    if (!waitSem(proc, 'full')) return;
    if (!waitSem(proc, 'mutex')) return;

    const slot = sem.outPointer;
    const itemId = buffer[slot];
    mechanismAction(proc, itemId, 'consume');
    buffer[slot] = null;
    sem.outPointer = (sem.outPointer + 1) % params.bufferSize;
    consumed += 1;
    proc.consumed += 1;
    proc.log.unshift(`consumed item_${itemId}`);
    proc.log = proc.log.slice(0, 3);
    emit({
      processId: proc.pid,
      processType: proc.type,
      action: 'consume',
      itemId,
      activeSlot: slot,
      mechanismLabel: params.mechanism === 'pipe' ? 'read' : params.mechanism === 'message-queue' ? 'dequeue' : 'consume',
      logMessage: `${proc.pid} consumed item_${itemId} from slot ${slot}`,
      eventType: 'consume',
    });
    signalSem(proc, 'mutex');
    signalSem(proc, 'empty');

    if (consumed >= params.totalItems) {
      processes.forEach((entry) => {
        if (!entry.done) {
          entry.done = true;
          entry.state = 'DONE';
          entry.log.unshift('simulation complete');
          entry.log = entry.log.slice(0, 3);
        }
      });
      emit({
        processId: proc.pid,
        processType: proc.type,
        action: 'done',
        logMessage: `all ${params.totalItems} items consumed`,
        eventType: 'signal',
      });
      return;
    }

    proc.phase = 0;
    proc.state = 'WAITING';
  }

  function allDone() {
    return processes.every((proc) => proc.done);
  }

  function nextReadyIndex() {
    const total = processes.length;
    for (let offset = 0; offset < total; offset += 1) {
      const index = (rrCursor + offset) % total;
      const proc = processes[index];
      if (!proc.done && proc.state !== 'BLOCKED') return index;
    }
    return -1;
  }

  while (!allDone()) {
    const index = nextReadyIndex();
    if (index === -1) {
      deadlock = true;
      break;
    }
    rrCursor = (index + 1) % processes.length;
    const proc = processes[index];
    if (proc.type === 'producer') {
      produceTurn(proc);
    } else {
      consumeTurn(proc);
    }
    if (produced >= params.totalItems && consumed >= params.totalItems) break;
  }

  if (!deadlock) {
    processes.forEach((proc) => {
      if (!proc.done) {
        proc.done = true;
        proc.state = 'DONE';
      }
    });
  }

  return { steps, deadlock };
}

function buildSkeleton() {
  const processes = initProcesses();
  DOM.processList.innerHTML = '';
  DOM.bufferCells.innerHTML = '';
  DOM.semList.innerHTML = '';
  DOM.eventLog.innerHTML = '';
  SEM_HISTORY.mutex.length = 0;
  SEM_HISTORY.empty.length = 0;
  SEM_HISTORY.full.length = 0;
  PROCESS_META.clear();

  processes.forEach((proc) => {
    const card = createEl('article', `process-card ${proc.type}`);
    card.id = `proc-${proc.pid}`;
    card.innerHTML = `
      <div class="process-head">
        <div class="process-name">${proc.pid}</div>
        <div class="state-badge state-waiting" id="badge-${proc.pid}">WAITING</div>
      </div>
      <div class="action-log" id="log-${proc.pid}">
        <div class="action-line empty">no events yet</div>
        <div class="action-line empty">&nbsp;</div>
        <div class="action-line empty">&nbsp;</div>
      </div>
      <div class="pcb-mini">
        <div class="pcb-field"><div class="pcb-label">PID</div><div class="pcb-value">${proc.pid}</div></div>
        <div class="pcb-field"><div class="pcb-label">TYPE</div><div class="pcb-value">${proc.type}</div></div>
        <div class="pcb-field"><div class="pcb-label">STATE</div><div class="pcb-value" id="pcb-state-${proc.pid}">WAITING</div></div>
        <div class="pcb-field"><div class="pcb-label">ITEMS</div><div class="pcb-value" id="pcb-count-${proc.pid}">0 / ${proc.quota}</div></div>
      </div>
    `;
    DOM.processList.appendChild(card);
    PROCESS_META.set(proc.pid, {
      card,
      badge: $(`badge-${proc.pid}`),
      log: $(`log-${proc.pid}`),
      state: $(`pcb-state-${proc.pid}`),
      count: $(`pcb-count-${proc.pid}`),
    });
  });

  for (let index = 0; index < S.bufferSize; index += 1) {
    const cell = createEl('div', 'buffer-slot empty');
    cell.id = `buf-slot-${index}`;
    cell.innerHTML = `
      <div class="slot-index">SLOT ${String(index).padStart(2, '0')}</div>
      <div class="slot-item">—</div>
      <div class="slot-pill">EMPTY</div>
    `;
    DOM.bufferCells.appendChild(cell);
  }

  ['mutex', 'empty', 'full'].forEach((name) => {
    const card = createEl('article', 'sem-card');
    card.id = `sem-${name}`;
    card.innerHTML = `
      <div class="sem-top">
        <div class="sem-name">${name}</div>
        <div class="sem-value" id="sem-val-${name}">${name === 'mutex' ? 1 : name === 'empty' ? S.bufferSize : 0}</div>
      </div>
      <div class="sem-sub">VALUE HISTORY</div>
      <div class="sem-history" id="sem-hist-${name}"></div>
      <div class="sem-wait-title">WAITING</div>
      <div class="sem-wait-list" id="sem-wait-${name}"></div>
    `;
    DOM.semList.appendChild(card);
  });

  DOM.statsBar.classList.add('visible');
  DOM.vizSection.classList.add('visible');
  DOM.compareSection.style.display = 'none';
  DOM.bufHeader.textContent = `BUFFER [in:0 out:0 size:${S.bufferSize}]`;
  DOM.bufTop.textContent = '';
  DOM.bufBottom.textContent = '';
  DOM.bufferStage.classList.remove('buf-full', 'buf-empty');
  refreshConfigLabels();
  updateStatsBar({ stepNum: 0, produced: 0, consumed: 0, blockedCount: 0, deadlock: false });
  updateBufferPointers(0, 0);
}

function updateProcessCard(id, state, action, logMsg, meta = {}) {
  const cached = PROCESS_META.get(id);
  if (!cached) return;
  const { card, badge, log, state: stateNode, count } = cached;
  const normalized = String(state).toLowerCase();
  card.classList.remove('running', 'waiting', 'blocked', 'done', 'state-shake', 'state-unblock');
  card.classList.add(normalized);
  badge.className = `state-badge state-${normalized}`;
  badge.textContent = String(state).toUpperCase();
  stateNode.textContent = String(state).toUpperCase();
  count.textContent = `${meta.progress ?? 0} / ${meta.quota ?? 0}`;

  if (normalized === 'blocked') {
    card.classList.add('state-shake');
    setTimeout(() => card.classList.remove('state-shake'), 420);
  }
  if (action === 'unblocked') {
    card.classList.add('state-unblock');
    setTimeout(() => card.classList.remove('state-unblock'), 320);
  }

  if (logMsg) {
    const existing = Array.from(log.querySelectorAll('.action-line')).map((node) => node.textContent.trim()).filter(Boolean);
    existing.unshift(logMsg);
    const lines = existing.slice(0, 3);
    log.innerHTML = '';
    lines.forEach((line) => {
      log.appendChild(createEl('div', 'action-line', line));
    });
    while (log.children.length < 3) {
      log.appendChild(createEl('div', 'action-line empty', '\u00a0'));
    }
  }
}

function updateBufferCell(slot, itemId, isWrite, isRead) {
  const cell = $(`buf-slot-${slot}`);
  if (!cell) return;
  const itemNode = cell.querySelector('.slot-item');
  const pill = cell.querySelector('.slot-pill');
  const filled = itemId !== null && itemId !== undefined;
  cell.classList.remove('empty', 'filled', 'write', 'read');
  cell.classList.add(filled ? 'filled' : 'empty');
  itemNode.textContent = filled ? `item_${itemId}` : '—';
  pill.textContent = filled ? 'FILLED' : 'EMPTY';
  if (isWrite) {
    cell.classList.add('write');
    setTimeout(() => cell.classList.remove('write'), 620);
  }
  if (isRead) {
    cell.classList.add('read');
    setTimeout(() => cell.classList.remove('read'), 620);
  }
}

function updateSemaphoreCard(name, value, waiting) {
  const valueNode = $(`sem-val-${name}`);
  const histNode = $(`sem-hist-${name}`);
  const waitNode = $(`sem-wait-${name}`);
  const card = $(`sem-${name}`);
  if (!valueNode || !histNode || !waitNode || !card) return;
  valueNode.textContent = String(value);
  SEM_HISTORY[name].push(value);
  SEM_HISTORY[name] = SEM_HISTORY[name].slice(-8);
  histNode.innerHTML = '';
  SEM_HISTORY[name].forEach((entry) => {
    const bar = createEl('span');
    const height = Math.max(8, Math.min(24, 8 + (entry * 16) / Math.max(1, S.bufferSize)));
    bar.style.height = `${height}px`;
    bar.style.background = entry === 0 ? 'rgba(232,80,120,.38)' : 'rgba(74,157,232,.22)';
    histNode.appendChild(bar);
  });
  waitNode.innerHTML = '';
  if (waiting.length === 0) {
    waitNode.appendChild(createEl('span', 'wait-chip empty', 'none'));
  } else {
    waiting.forEach((pid) => waitNode.appendChild(createEl('span', 'wait-chip', pid)));
  }
  card.classList.remove('sem-zero', 'sem-signal');
  if (value === 0) {
    card.classList.add('sem-zero');
  }
}

function updateBufferPointers(inPointer, outPointer) {
  const slotHeight = 60;
  DOM.inPointer.style.top = `${12 + inPointer * slotHeight}px`;
  DOM.outPointer.style.top = `${12 + outPointer * slotHeight}px`;
}

function appendEventLog(step) {
  const row = createEl('div', `event-row ${step.eventType}`);
  row.innerHTML = `
    <span class="event-cell event-step">[${step.stepNum}]</span>
    <span class="event-cell event-time">${step.timestamp}</span>
    <span class="event-cell event-proc">${step.processId}</span>
    <span class="event-cell event-action">${step.action}</span>
    <span class="event-cell event-result">${step.logMessage}</span>
  `;
  DOM.eventLog.appendChild(row);
  const rows = DOM.eventLog.querySelectorAll('.event-row');
  if (rows.length > 40) rows[0].remove();
  DOM.eventLog.scrollTop = DOM.eventLog.scrollHeight;
}

function updateStatsBar(step) {
  DOM.stats.step.textContent = String(step.stepNum ?? 0);
  DOM.stats.produced.textContent = String(step.produced ?? 0);
  DOM.stats.consumed.textContent = String(step.consumed ?? 0);
  DOM.stats.blocked.textContent = String(step.blockedCount ?? 0);
  DOM.stats.deadlock.textContent = step.deadlock ? 'YES' : 'NO';
}

function syncStep(step) {
  DOM.bufHeader.textContent = `BUFFER [in:${step.inPointer} out:${step.outPointer} size:${S.bufferSize}]`;
  const full = step.bufferSnapshot.every((slot) => slot !== null);
  const empty = step.bufferSnapshot.every((slot) => slot === null);
  DOM.bufTop.textContent = full ? 'BUFFER FULL — PRODUCERS BLOCKED' : '';
  DOM.bufBottom.textContent = empty ? 'BUFFER EMPTY — CONSUMERS BLOCKED' : '';
  DOM.bufTop.classList.toggle('full', full);
  DOM.bufBottom.classList.toggle('empty', empty);
  DOM.bufferStage.classList.toggle('buf-full', full);
  DOM.bufferStage.classList.toggle('buf-empty', empty);
  updateBufferPointers(step.inPointer, step.outPointer);

  step.bufferSnapshot.forEach((itemId, index) => {
    const isWrite = step.action === 'produce' && step.activeSlot === index;
    const isRead = step.action === 'consume' && step.activeSlot === index;
    updateBufferCell(index, itemId, isWrite, isRead);
  });

  Object.entries(step.processStates).forEach(([pid, state]) => {
    const progress = step.processProgress?.[pid] ?? { produced: 0, consumed: 0, quota: 0 };
    const shownCount = pid.startsWith('P') ? progress.produced : progress.consumed;
    updateProcessCard(pid, state, pid === step.processId ? step.action : '', pid === step.processId ? step.logMessage : '', {
      progress: shownCount,
      quota: progress.quota,
    });
  });

  updateSemaphoreCard('mutex', step.semaphoreSnapshot.mutex, step.waitingOn.mutex);
  updateSemaphoreCard('empty', step.semaphoreSnapshot.empty, step.waitingOn.empty);
  updateSemaphoreCard('full', step.semaphoreSnapshot.full, step.waitingOn.full);
  appendEventLog(step);
  updateStatsBar(step);
}

function animateStep(index) {
  const step = S.steps[index];
  if (!step) return;
  S.cursor = index + 1;
  syncStep(step);
  if (S.cursor >= S.steps.length && S.status === 'running') {
    finishSimulation();
  }
}

function playNextStep() {
  if (S.cursor >= S.steps.length) {
    finishSimulation();
    return;
  }
  animateStep(S.cursor);
}

function buildSkeleton() {
  const processes = initProcesses();
  DOM.processList.innerHTML = '';
  DOM.bufferCells.innerHTML = '';
  DOM.semList.innerHTML = '';
  DOM.eventLog.innerHTML = '';
  SEM_HISTORY.mutex.length = 0;
  SEM_HISTORY.empty.length = 0;
  SEM_HISTORY.full.length = 0;
  PROCESS_META.clear();

  processes.forEach((proc) => {
    const card = createEl('article', `process-card ${proc.type}`);
    card.id = `proc-${proc.pid}`;
    card.innerHTML = `
      <div class="process-head">
        <div class="process-name">${proc.pid}</div>
        <div class="state-badge state-waiting" id="badge-${proc.pid}">WAITING</div>
      </div>
      <div class="action-log" id="log-${proc.pid}">
        <div class="action-line empty">no events yet</div>
        <div class="action-line empty">&nbsp;</div>
        <div class="action-line empty">&nbsp;</div>
      </div>
      <div class="pcb-mini">
        <div class="pcb-field"><div class="pcb-label">PID</div><div class="pcb-value">${proc.pid}</div></div>
        <div class="pcb-field"><div class="pcb-label">TYPE</div><div class="pcb-value">${proc.type}</div></div>
        <div class="pcb-field"><div class="pcb-label">STATE</div><div class="pcb-value" id="pcb-state-${proc.pid}">WAITING</div></div>
        <div class="pcb-field"><div class="pcb-label">ITEMS</div><div class="pcb-value" id="pcb-count-${proc.pid}">0 / ${proc.quota}</div></div>
      </div>
    `;
    DOM.processList.appendChild(card);
    PROCESS_META.set(proc.pid, {
      card,
      badge: $(`badge-${proc.pid}`),
      log: $(`log-${proc.pid}`),
      state: $(`pcb-state-${proc.pid}`),
      count: $(`pcb-count-${proc.pid}`),
    });
  });

  for (let index = 0; index < S.bufferSize; index += 1) {
    const cell = createEl('div', 'buffer-slot empty');
    cell.id = `buf-slot-${index}`;
    cell.innerHTML = `
      <div class="slot-index">SLOT ${String(index).padStart(2, '0')}</div>
      <div class="slot-item">—</div>
      <div class="slot-pill">EMPTY</div>
    `;
    DOM.bufferCells.appendChild(cell);
  }

  ['mutex', 'empty', 'full'].forEach((name) => {
    const card = createEl('article', 'sem-card');
    card.id = `sem-${name}`;
    card.innerHTML = `
      <div class="sem-top">
        <div class="sem-name">${name}</div>
        <div class="sem-value" id="sem-val-${name}">${name === 'mutex' ? 1 : name === 'empty' ? S.bufferSize : 0}</div>
      </div>
      <div class="sem-sub">VALUE HISTORY</div>
      <div class="sem-history" id="sem-hist-${name}"></div>
      <div class="sem-wait-title">WAITING</div>
      <div class="sem-wait-list" id="sem-wait-${name}"></div>
    `;
    DOM.semList.appendChild(card);
  });

  DOM.statsBar.classList.add('visible');
  DOM.vizSection.classList.add('visible');
  DOM.compareSection.style.display = 'none';
  DOM.bufHeader.textContent = `BUFFER [in:0 out:0 size:${S.bufferSize}]`;
  DOM.bufTop.textContent = '';
  DOM.bufBottom.textContent = '';
  DOM.bufferStage.classList.remove('buf-full', 'buf-empty');
  refreshConfigLabels();
  updateStatsBar({ stepNum: 0, produced: 0, consumed: 0, blockedCount: 0, deadlock: false });
  updateBufferPointers(0, 0);
}

function summaryForMechanism(mech, steps) {
  const weightedSteps = steps.length * MECHANISMS[mech].cost;
  const blockedSteps = steps.filter((step) => step.eventType === 'block').length;
  const waitSteps = steps.filter((step) => step.eventType === 'wait').length;
  const contextSwitches = steps.reduce((count, step, index) => {
    if (index === 0) return 0;
    return count + (step.processId !== steps[index - 1].processId ? 1 : 0);
  }, 0);
  const throughput = (S.totalItems / Math.max(1, weightedSteps)) * 100;
  const avgWaitTime = ((blockedSteps + waitSteps * 0.5) / Math.max(1, S.totalItems)).toFixed(2);
  return {
    throughput: throughput.toFixed(1),
    avgWaitTime,
    contextSwitches,
  };
}

function renderComparison() {
  const params = { ...currentParams() };
  const data = Object.keys(MECHANISMS).map((mech) => {
    const result = simulate({ ...params, mechanism: mech });
    return {
      mech,
      summary: summaryForMechanism(mech, result.steps),
    };
  });

  DOM.compareGrid.innerHTML = '';
  const best = data.reduce((winner, item) => (Number(item.summary.throughput) > Number(winner.summary.throughput) ? item : winner), data[0]);
  const maxThroughput = Math.max(...data.map((item) => Number(item.summary.throughput)));

  data.forEach((item) => {
    const card = createEl('article', `cmp-card${item.mech === best.mech ? ' best' : ''}`);
    card.style.setProperty('--card-accent', MECHANISMS[item.mech].accent);
    card.innerHTML = `
      <div class="cmp-head">
        <div>
          <div class="cmp-name">${MECHANISMS[item.mech].compare}</div>
          ${item.mech === best.mech ? '<div class="best-badge">BEST</div>' : ''}
        </div>
        <div class="cmp-ico">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="20" r="7" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="28" cy="20" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M17 20h6M21 16l2 4-2 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
      <div class="cmp-bar-bg"><div class="cmp-bar" style="width:${Math.max(12, (Number(item.summary.throughput) / maxThroughput) * 100)}%"></div></div>
      <div class="cmp-meta">
        <div class="cmp-stat"><span class="cmp-stat-lbl">AVG WAIT</span><span class="cmp-stat-val">${item.summary.avgWaitTime}</span></div>
        <div class="cmp-stat"><span class="cmp-stat-lbl">CTX SWITCHES</span><span class="cmp-stat-val">${item.summary.contextSwitches}</span></div>
        <div class="cmp-stat"><span class="cmp-stat-lbl">THROUGHPUT</span><span class="cmp-stat-val">${item.summary.throughput}</span></div>
      </div>
      <div class="cmp-list">
        <div>
          <ul>
            <li>Bounded-buffer flow stays deterministic.</li>
            <li>Simple semaphore coordination model.</li>
          </ul>
        </div>
        <div>
          <ul>
            <li>Higher coordination overhead than raw memory.</li>
            <li>Pipe and queue variants add extra handoff cost.</li>
          </ul>
        </div>
      </div>
    `;
    DOM.compareGrid.appendChild(card);
  });
  DOM.compareSection.style.display = 'block';
}

function finishSimulation() {
  clearTimers();
  S.status = 'done';
  setControls();
  DOM.stats.deadlock.textContent = 'NO';
  renderComparison();
}

function runSimulation(autoPlay = true) {
  clearTimers();
  S.steps = [];
  S.cursor = 0;
  S.status = autoPlay ? 'running' : 'paused';
  S.steps = simulate({ ...currentParams(), mechanism: S.mechanism }).steps;
  buildSkeleton();
  DOM.compareSection.style.display = 'none';
  refreshConfigLabels();
  setControls();
  if (S.steps.length === 0) return;
  if (autoPlay) {
    playNextStep();
    S.timer = setInterval(() => {
      if (S.status !== 'running') return;
      playNextStep();
      if (S.cursor >= S.steps.length) finishSimulation();
    }, currentDelay());
  } else {
    updateStatsBar({ stepNum: 0, produced: 0, consumed: 0, blockedCount: 0, deadlock: false });
  }
}

function pauseSimulation() {
  if (S.status === 'running') {
    clearTimers();
    S.status = 'paused';
    setControls();
    return;
  }
  if (S.status === 'paused' && S.cursor < S.steps.length) {
    S.status = 'running';
    setControls();
    S.timer = setInterval(() => {
      if (S.status !== 'running') return;
      playNextStep();
      if (S.cursor >= S.steps.length) finishSimulation();
    }, currentDelay());
  }
}

function stepSimulation() {
  if (S.status === 'idle') {
    runSimulation(false);
  }
  clearTimers();
  if (S.cursor >= S.steps.length) {
    finishSimulation();
    return;
  }
  S.status = 'paused';
  setControls();
  playNextStep();
  if (S.cursor >= S.steps.length) finishSimulation();
}

function resetSimulation() {
  clearTimers();
  S.status = 'idle';
  S.steps = [];
  S.cursor = 0;
  DOM.processList.innerHTML = '';
  DOM.bufferCells.innerHTML = '';
  DOM.semList.innerHTML = '';
  DOM.eventLog.innerHTML = '';
  DOM.compareSection.style.display = 'none';
  DOM.statsBar.classList.remove('visible');
  DOM.vizSection.classList.remove('visible');
  DOM.bufHeader.textContent = `BUFFER [in:0 out:0 size:${S.bufferSize}]`;
  DOM.bufTop.textContent = '';
  DOM.bufBottom.textContent = '';
  DOM.bufTop.classList.remove('full');
  DOM.bufBottom.classList.remove('empty');
  DOM.bufferStage.classList.remove('buf-full', 'buf-empty');
  refreshConfigLabels();
  updateStatsBar({ stepNum: 0, produced: 0, consumed: 0, blockedCount: 0, deadlock: false });
  setControls();
}

function bindControls() {
  DOM.mechTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      S.mechanism = tab.dataset.mech;
      refreshConfigLabels();
    });
  });

  DOM.inputs.buf.dec.addEventListener('click', () => updateConfigValue('bufferSize', -1, 1, 16));
  DOM.inputs.buf.inc.addEventListener('click', () => updateConfigValue('bufferSize', 1, 1, 16));
  DOM.inputs.prod.dec.addEventListener('click', () => updateConfigValue('producerCount', -1, 1, 4));
  DOM.inputs.prod.inc.addEventListener('click', () => updateConfigValue('producerCount', 1, 1, 4));
  DOM.inputs.cons.dec.addEventListener('click', () => updateConfigValue('consumerCount', -1, 1, 4));
  DOM.inputs.cons.inc.addEventListener('click', () => updateConfigValue('consumerCount', 1, 1, 4));
  DOM.inputs.items.dec.addEventListener('click', () => updateConfigValue('totalItems', -1, 4, 32));
  DOM.inputs.items.inc.addEventListener('click', () => updateConfigValue('totalItems', 1, 4, 32));

  DOM.speedSlider.addEventListener('input', () => {
    S.speed = Number(DOM.speedSlider.value);
    refreshConfigLabels();
    if (S.status === 'running') {
      clearTimers();
      S.timer = setInterval(() => {
        if (S.status !== 'running') return;
        playNextStep();
        if (S.cursor >= S.steps.length) finishSimulation();
      }, currentDelay());
    }
  });

  DOM.buttons.run.addEventListener('click', () => {
    if (S.status === 'paused' && S.steps.length > 0) {
      S.status = 'running';
      setControls();
      clearTimers();
      S.timer = setInterval(() => {
        if (S.status !== 'running') return;
        playNextStep();
        if (S.cursor >= S.steps.length) finishSimulation();
      }, currentDelay());
      return;
    }
    runSimulation(true);
  });

  DOM.buttons.pause.addEventListener('click', pauseSimulation);
  DOM.buttons.step.addEventListener('click', stepSimulation);
  DOM.buttons.reset.addEventListener('click', resetSimulation);
  window.addEventListener('beforeunload', clearTimers);
}

function boot() {
  refreshConfigLabels();
  setControls();
  bindControls();
}

boot();
