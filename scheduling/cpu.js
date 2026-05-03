/* ── CPU Scheduling Engine: Final Whole Code ── */
document.addEventListener('DOMContentLoaded', () => {
    class CPUSystem {
        constructor() {
            this.procs = [];
            // Initializing with default config
            this.queues = [{ algo: 'fcfs', quantum: 2 }];
            this.timeline = [];
            this.init();
        }

        init() {
            document.getElementById('algo-master').onchange = (e) => this.updateUI(e.target.value);
            document.getElementById('btn-add-q').onclick = () => this.addQueueRow();
            document.getElementById('btn-rem-q').onclick = () => this.remQueueRow();
            document.getElementById('add-btn').onclick = () => this.addProcess();
            document.getElementById('run-btn').onclick = () => this.solve();
            document.getElementById('reset-btn').onclick = () => this.reset();
            
            document.getElementById('p-target-q').onchange = () => this.checkPriorityRequirement();
            // Listen for any changes within the dynamic queue list
            document.getElementById('queue-list').addEventListener('change', (e) => {
                this.checkPriorityRequirement();
                // Toggle TQ box visibility if local algo changes
                if (e.target.classList.contains('q-algo')) {
                    const tqBox = e.target.parentElement.querySelector('.q-tq');
                    if (tqBox) tqBox.style.display = (e.target.value === 'rr') ? 'block' : 'none';
                }
            });

            this.updateUI('fcfs');
        }

        updateUI(algo) {
            const isMLQ = algo.startsWith('mlq');
            const isMLFQ = (algo === 'mlfq');
            const isRR = (algo === 'rr');

            document.getElementById('queue-designer').style.display = (isMLQ || isMLFQ) ? 'block' : 'none';
            document.getElementById('single-q-config').style.display = isRR ? 'block' : 'none';
            document.getElementById('p-target-q').style.display = isMLQ ? 'block' : 'none';
            document.querySelectorAll('.col-q').forEach(el => el.style.display = isMLQ ? 'table-cell' : 'none');

            if (isMLFQ) {
                this.queues = [{quantum: 2}, {quantum: 4}, {quantum: 8}];
            } else if (isMLQ) {
                this.queues = [{algo: 'rr', quantum: 2}, {algo: 'fcfs', quantum: 2}];
            } else {
                this.queues = [{algo: algo}];
            }
            
            this.renderQueueDesigner(isMLFQ ? 'mlfq' : 'mlq');
            this.checkPriorityRequirement();
        }

        checkPriorityRequirement() {
            const master = document.getElementById('algo-master').value;
            // MLQ and MLFQ now strictly follow their internal logic, no extra priority input needed unless master is Priority
            const needsPri = master.includes('p-');
            document.getElementById('p-pri').style.display = needsPri ? 'block' : 'none';
            document.querySelectorAll('.col-pri').forEach(el => el.style.display = needsPri ? 'table-cell' : 'none');
        }

        renderQueueDesigner(mode) {
            const list = document.getElementById('queue-list');
            list.innerHTML = '';
            this.queues.forEach((q, i) => {
                const div = document.createElement('div');
                div.className = 'queue-item';
                // Priority removed from MLQ options per request
                div.innerHTML = mode === 'mlfq' 
                    ? `<span>Q${i+1}</span><input type="number" value="${q.quantum}" class="q-tq" placeholder="TQ">`
                    : `<span>Q${i+1}</span>
                       <select class="q-algo">
                        <option value="fcfs" ${q.algo==='fcfs'?'selected':''}>FCFS</option>
                        <option value="rr" ${q.algo==='rr'?'selected':''}>RR</option>
                        <option value="sjf" ${q.algo==='sjf'?'selected':''}>SJF</option>
                       </select>
                       <input type="number" value="${q.quantum || 2}" class="q-tq" style="display: ${q.algo==='rr'?'block':'none'}" placeholder="TQ">`;
                list.appendChild(div);
            });
            this.updateProcessQueueDropdown();
        }

        addQueueRow() {
            if (this.queues.length >= 5) return;
            this.queues.push({ algo: 'fcfs', quantum: 2 });
            this.renderQueueDesigner(document.getElementById('algo-master').value === 'mlfq' ? 'mlfq' : 'mlq');
        }

        remQueueRow() {
            if (this.queues.length <= 1) return;
            this.queues.pop();
            this.renderQueueDesigner(document.getElementById('algo-master').value === 'mlfq' ? 'mlfq' : 'mlq');
        }

        updateProcessQueueDropdown() {
            const sel = document.getElementById('p-target-q');
            sel.innerHTML = this.queues.map((_, i) => `<option value="${i}">Queue ${i+1}</option>`).join('');
        }

        addProcess() {
            const name = document.getElementById('p-name').value.trim();
            const at = document.getElementById('p-at').value;
            const bt = document.getElementById('p-bt').value;
            const pri = document.getElementById('p-pri').value;
            const isPriVisible = document.getElementById('p-pri').style.display === 'block';

            if (!name || at === "" || bt === "") { alert("Missing Process Details"); return; }

            this.procs.push({
                name: name,
                at: parseInt(at), bt: parseInt(bt), rem: parseInt(bt),
                pri: isPriVisible ? parseInt(pri) : 0,
                targetQ: parseInt(document.getElementById('p-target-q').value) || 0,
                id: this.procs.length,
                lastRun: -1 // Used for RR tracking within MLQ
            });
            this.renderTable();
            ['p-name', 'p-at', 'p-bt', 'p-pri'].forEach(id => document.getElementById(id).value = '');
        }

        solve() {
            if (!this.procs.length) { alert("Add processes first!"); return; }
            const master = document.getElementById('algo-master').value;
            let work = JSON.parse(JSON.stringify(this.procs));
            this.timeline = [];
            
            // CRITICAL: Sync current DOM values into memory
            document.querySelectorAll('.queue-item').forEach((el, i) => {
                const aI = el.querySelector('.q-algo');
                const tI = el.querySelector('.q-tq');
                if(aI) this.queues[i].algo = aI.value;
                if(tI) this.queues[i].quantum = parseInt(tI.value) || 2;
            });

            if (master === 'fcfs') this.runFCFS(work);
            else if (master === 'sjf') this.runSJF(work, false); 
            else if (master === 'srtf') this.runSJF(work, true);  
            else if (master === 'p-np') this.runPriority(work, false);
            else if (master === 'p-p') this.runPriority(work, true);
            else if (master === 'rr') this.runRR(work, parseInt(document.getElementById('global-quantum').value));
            else if (master.startsWith('mlq')) this.runMLQ(work, master === 'mlq-p');
            else if (master === 'mlfq') this.runMLFQ(work);

            this.renderGantt();
            this.renderTable(work);
            this.updateStats(work);
        }

     /* ── Fixed MLQ Preemptive Logic ── */
// This function ensures that processes respect their Time Quantum within a queue,
// while still allowing higher-priority queues to preempt them every 1 unit.

runMLQ(ps, preempt) {
    let t = 0, done = 0;
    // Initialize tracking variables for every process
    ps.forEach(p => { 
        p.usedInLevel = 0; 
        p.qEntry = p.at; 
    });

    while (done < ps.length) {
        let activeQIdx = -1;
        // 1. Identify the highest priority non-empty queue at time 't'
        for (let i = 0; i < this.queues.length; i++) {
            if (ps.some(p => p.at <= t && p.rem > 0 && p.targetQ === i)) {
                activeQIdx = i;
                break;
            }
        }

        // Handle CPU Idle time
        if (activeQIdx === -1) {
            this.pushG('Idle', 1, -1, true);
            t++; 
            continue;
        }

        const qCfg = this.queues[activeQIdx];
        let candidates = ps.filter(p => p.at <= t && p.rem > 0 && p.targetQ === activeQIdx);
        
        // 2. Sort candidates within the same queue for fairness
        if (qCfg.algo === 'rr') {
            // Round Robin: sort by arrival/entry time and ID
            candidates.sort((a, b) => a.qEntry - b.qEntry || a.at - b.at || a.id - b.id);
        } else if (qCfg.algo === 'sjf') {
            // SJF: sort by shortest remaining time
            candidates.sort((a, b) => a.rem - b.rem || a.at - b.at);
        } else {
            // FCFS: sort by arrival time
            candidates.sort((a, b) => a.at - b.at);
        }

        let p = candidates[0];
        
        // 3. Determine execution step
        // If 'preempt' is true (MLQ-P), we only run for 1 unit so we can 
        // re-check if a process arrived in a higher-priority queue.
        // If 'preempt' is false (MLQ-NP), we run for the full slice.
        let step = 1;
        if (!preempt) {
            step = (qCfg.algo === 'rr') ? Math.min(p.rem, qCfg.quantum) : p.rem;
        }

        this.pushG(p.name, step, p.id);
        p.rem -= step;
        p.usedInLevel += step;
        t += step;

        // 4. Handle process completion or quantum expiration
        if (p.rem === 0) {
            p.ct = t; 
            p.tat = p.ct - p.at; 
            p.wt = p.tat - p.bt;
            done++;
        } else {
            // FIX: Within the same queue, only rotate (change qEntry) 
            // if the process has exhausted its local Time Quantum.
            if (qCfg.algo === 'rr' && p.usedInLevel >= qCfg.quantum) {
                p.qEntry = t; // Moves it to the back of the queue
                p.usedInLevel = 0; // Reset counter for its next turn
            }
        }
    }
}

        // FCFS, SJF, RR methods remain unchanged
        runFCFS(ps) {
            ps.sort((a,b) => a.at - b.at); let t = 0;
            ps.forEach(p => {
                if(t < p.at) { this.pushG('Idle', p.at - t, -1, true); t = p.at; }
                this.pushG(p.name, p.bt, p.id); t += p.bt;
                p.ct = t; p.tat = p.ct - p.at; p.wt = p.tat - p.bt;
            });
        }

        runSJF(ps, preempt) {
            let t = 0, done = 0;
            while (done < ps.length) {
                let ready = ps.filter(p => p.at <= t && p.rem > 0).sort((a,b) => a.rem - b.rem || a.at - b.at);
                if (!ready.length) { this.pushG('Idle', 1, -1, true); t++; continue; }
                let p = ready[0];
                let run = preempt ? 1 : p.rem;
                this.pushG(p.name, run, p.id);
                p.rem -= run; t += run;
                if (p.rem === 0) { p.ct = t; p.tat = p.ct - p.at; p.wt = p.tat - p.bt; done++; }
            }
        }

        runPriority(ps, preempt) {
            let t = 0, done = 0;
            while (done < ps.length) {
                let ready = ps.filter(p => p.at <= t && p.rem > 0).sort((a,b) => a.pri - b.pri || a.at - b.at);
                if (!ready.length) { this.pushG('Idle', 1, -1, true); t++; continue; }
                let p = ready[0];
                let run = preempt ? 1 : p.rem;
                this.pushG(p.name, run, p.id);
                p.rem -= run; t += run;
                if (p.rem === 0) { p.ct = t; p.tat = p.ct - p.at; p.wt = p.tat - p.bt; done++; }
            }
        }

        runRR(ps, q) {
            let t = 0, done = 0, qu = [];
            while (done < ps.length) {
                ps.filter(p => p.at <= t && p.rem > 0 && !qu.includes(p)).forEach(p => qu.push(p));
                if (!qu.length) { this.pushG('Idle', 1, -1, true); t++; continue; }
                let p = qu.shift();
                let slice = Math.min(p.rem, q);
                this.pushG(p.name, slice, p.id);
                p.rem -= slice; t += slice;
                ps.filter(pr => pr.at <= t && pr.rem > 0 && !qu.includes(pr) && pr !== p).forEach(pr => qu.push(pr));
                if (p.rem > 0) qu.push(p); else { p.ct = t; p.tat = p.ct - p.at; p.wt = p.tat - p.bt; done++; }
            }
        }

      runMLFQ(ps) {
    let t = 0, done = 0;
    const uiQueueCount = this.queues.length;
    
    // Initialize Level, Time of entry, and Quantum usage
    ps.forEach(p => { 
        p.level = 0; 
        p.qEntry = p.at; 
        p.usedInLevel = 0; 
    });

    while (done < ps.length) {
        // Find all arrived processes that still have work
        let available = ps.filter(p => p.at <= t && p.rem > 0);

        if (available.length === 0) {
            this.pushG('Idle', 1, -1, true);
            t++;
            continue;
        }

        // 1. Sort by Level (Priority)
        // 2. Sort by qEntry (RR Fairness for processes in the same level)
        available.sort((a, b) => a.level - b.level || a.qEntry - b.qEntry);
        let p = available[0];

        // Execute exactly 1 unit to allow preemption at the next arrival time
        this.pushG(p.name, 1, p.id);
        p.rem -= 1;
        p.usedInLevel += 1;
        t += 1;

        if (p.rem === 0) {
            p.ct = t; 
            p.tat = p.ct - p.at; 
            p.wt = p.tat - p.bt;
            done++;
        } else {
            // Demotion Logic: Only happens if process used its full quantum in that level
            if (p.level < uiQueueCount) {
                let currentQuantum = this.queues[p.level].quantum;
                if (p.usedInLevel >= currentQuantum) {
                    p.level++;         
                    p.usedInLevel = 0; 
                    p.qEntry = t;      
                }
            }
        }
    }
}
        pushG(name, dur, id, idle = false) {
            if (this.timeline.length && this.timeline[this.timeline.length - 1].name === name) {
                this.timeline[this.timeline.length - 1].dur += dur;
            } else {
                this.timeline.push({ name, dur, id, idle });
            }
        }

        renderGantt() {
            const chart = document.getElementById('g-chart'), axis = document.getElementById('g-axis');
            chart.innerHTML = ''; axis.innerHTML = '';
            let total = this.timeline.reduce((s, b) => s + b.dur, 0), cur = 0;
            this.timeline.forEach(b => {
                const d = document.createElement('div');
                d.className = `g-block ${b.idle ? 'idle' : 'p' + (b.id % 5)}`;
                d.style.width = `${(b.dur / total) * 100}%`; d.innerText = b.name;
                chart.appendChild(d);
                const s = document.createElement('span'); s.className = 'g-time';
                s.style.left = `${(cur / total) * 100}%`; s.innerText = cur;
                axis.appendChild(s); cur += b.dur;
            });
            const l = document.createElement('span'); l.className = 'g-time'; l.style.right = '0';
            l.innerText = cur; axis.appendChild(l);
        }

        renderTable(data = this.procs) {
            const body = document.getElementById('res-body');
            const isPri = document.getElementById('p-pri').style.display === 'block';
            const isQ = document.getElementById('p-target-q').style.display === 'block';
            
            body.innerHTML = data.map(p => {
                const ct = (p.ct !== undefined) ? p.ct : '-';
                const tat = (p.tat !== undefined) ? p.tat : '-';
                const wt = (p.wt !== undefined) ? p.wt : '-';
                return `<tr><td>${p.name}</td><td>${p.at}</td><td>${p.bt}</td>
                        ${isPri ? `<td>${p.pri}</td>` : ''}
                        ${isQ ? `<td>Q${p.targetQ + 1}</td>` : ''}
                        <td>${ct}</td><td>${tat}</td><td>${wt}</td></tr>`;
            }).join('');
        }

        updateStats(ps) {
            if(!ps.length) return;
            document.getElementById('avg-wt').innerText = (ps.reduce((s, p) => s + p.wt, 0) / ps.length).toFixed(2);
            document.getElementById('avg-tat').innerText = (ps.reduce((s, p) => s + p.tat, 0) / ps.length).toFixed(2);
        }

        reset() {
            this.procs = []; this.timeline = []; this.renderTable();
            document.getElementById('g-chart').innerHTML = '';
            document.getElementById('g-axis').innerHTML = '';
            document.getElementById('avg-wt').innerText = '0.00';
            document.getElementById('avg-tat').innerText = '0.00';
        }
    }
    new CPUSystem();
});