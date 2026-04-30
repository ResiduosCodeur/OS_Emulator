let drivers = [
    { id: 'gpu', name: 'Display Driver', type: 'Video', size: '128 KB', status: 'STANDBY' },
    { id: 'nic', name: 'Network Interface', type: 'Network', size: '64 KB', status: 'STANDBY' }
];

let interruptQueue = []; // The serial storage queue
let isProcessing = false; // Semaphore to ensure serial processing

const log = document.getElementById('driverLog');
const queueViz = document.getElementById('dynamicQueue');
const latencySlider = document.getElementById('latencySlider');
const latencyVal = document.getElementById('latencyVal');

// Update Latency Label
latencySlider.oninput = () => { latencyVal.innerText = (latencySlider.value / 1000).toFixed(1) + 's'; };

function addLog(msg, type = '') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.prepend(entry);
}

// 1. ADDING TO QUEUE (In order of generation)
function manualTrigger(deviceId) {
    const dev = drivers.find(d => d.id === deviceId);
    if (dev.status !== 'LOADED') {
        addLog(`ERROR: ${dev.name} driver not loaded!`, "warning");
        return;
    }

    addLog(`IRQ: Signal received from ${dev.name}. Adding to queue.`, "success");
    interruptQueue.push(dev); // Stored in serial order
    renderQueue();
    
    // Start processing loop if not already running
    if (!isProcessing) {
        processNextInterrupt();
    }
}

// 2. RENDERING THE QUEUE
function renderQueue() {
    if (interruptQueue.length === 0) {
        queueViz.innerHTML = '<div style="color: rgba(255,255,255,0.2); font-size: 11px; margin: auto;">QUEUE EMPTY</div>';
        return;
    }

    queueViz.innerHTML = '';
    interruptQueue.forEach((dev, index) => {
        const div = document.createElement('div');
        div.className = 'ram-block';
        div.innerText = dev.id.toUpperCase();
        div.style.minWidth = '80px';
        div.style.padding = '10px';
        
        // VISUALIZATION: Only the first item (index 0) is "Bright" (Active)
        if (index === 0 && isProcessing) {
            div.style.background = 'rgba(74, 157, 232, 0.6)';
            div.style.borderColor = 'var(--blue-mid)';
            div.style.boxShadow = '0 0 15px var(--blue-mid)';
            div.style.color = 'white';
            div.innerHTML += '<br><small style="font-size:8px;">PROCESSING...</small>';
        } else {
            div.style.opacity = '0.5'; // Rest are waiting
        }
        queueViz.appendChild(div);
    });
}

// 3. SERIAL PROCESSING (One by One)
async function processNextInterrupt() {
    if (interruptQueue.length === 0) {
        isProcessing = false;
        renderQueue();
        return;
    }

    isProcessing = true;
    const currentDevice = interruptQueue[0]; // Get the Head
    renderQueue(); // Update UI to show the Head glowing

    // Delay based on user input
    await new Promise(r => setTimeout(r, parseInt(latencySlider.value)));

    addLog(`I/O: Request from ${currentDevice.id.toUpperCase()} completed.`, "success");
    
    interruptQueue.shift(); // Remove the head after processing
    processNextInterrupt(); // Move to the next one in the queue
}

// REST OF THE FUNCTIONS (Remain same for management)
function addNewDeviceUI() {
    const nameInput = document.getElementById('devName');
    if (!nameInput.value) return;
    const id = nameInput.value.toLowerCase().replace(/\s/g, '-');
    drivers.push({ id: id, name: nameInput.value, type: 'External', size: '32 KB', status: 'WARNING' });
    addLog(`⚠ KERNEL: New device "${nameInput.value}" connected. Driver missing!`, "warning");
    nameInput.value = '';
    renderDriverInventory();
}

function removeDevice(index) {
    const dev = drivers[index];
    addLog(`System: Device [${dev.name}] disconnected.`, "warning");
    drivers.splice(index, 1);
    renderDriverInventory();
}

// Initial Render and Reset logic...
function renderDriverInventory() {
    const driverList = document.getElementById('driverList');
    driverList.innerHTML = '';
    drivers.forEach((d, index) => {
        const div = document.createElement('div');
        div.className = 'memory-block';
        div.style.flexDirection = 'column';
        div.style.marginBottom = '12px';
        const statusColor = d.status === 'LOADED' ? 'var(--green)' : (d.status === 'WARNING' ? 'var(--pink)' : 'var(--blue-200)');
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 8px;">
                <span><strong>${d.name}</strong> <small>(${d.type})</small></span>
                <span style="color: ${statusColor}; font-weight: bold;">${d.status}</span>
            </div>
            <div style="display: flex; gap: 5px; width: 100%;">
                <button onclick="manualTrigger('${d.id}')" class="btn" style="font-size: 10px; flex: 1; padding: 4px; background: rgba(74, 157, 232, 0.1); border: 1px solid var(--blue-mid); color: var(--blue-mid);">⚡ Interrupt</button>
                <button onclick="removeDevice(${index})" class="btn" style="font-size: 10px; flex: 1; padding: 4px; background: rgba(232, 80, 120, 0.1); border: 1px solid var(--pink); color: var(--pink);">✖ Remove</button>
            </div>
        `;
        driverList.appendChild(div);
    });
}

document.getElementById('loadAllBtn').onclick = async () => {
    for (let d of drivers) {
        if (d.status === 'LOADED') continue;
        await new Promise(r => setTimeout(r, 300));
        d.status = 'LOADED';
        const memBlock = document.createElement('div');
        memBlock.className = 'memory-block';
        memBlock.innerHTML = `<span>${d.id.toUpperCase()}</span> <span>${d.size}</span>`;
        document.getElementById('moduleMemContainer').appendChild(memBlock);
        addLog(`Kernel: Module [${d.name}] initialized.`, "success");
    }
    renderDriverInventory();
};

document.getElementById('resetBtn').onclick = () => {
    interruptQueue = [];
    isProcessing = false;
    log.innerHTML = '<div class="log-entry init">[SYS] Kernel buffer cleared.</div>';
    document.getElementById('moduleMemContainer').innerHTML = '';
    drivers = [];
    renderDriverInventory();
    renderQueue();
};

async function processNextInterrupt() {
    if (interruptQueue.length === 0) {
        isProcessing = false;
        // Turn off all flowchart glows
        document.querySelectorAll('.flow-node').forEach(n => n.classList.remove('glow-active'));
        renderQueue();
        return;
    }

    isProcessing = true;
    const currentDevice = interruptQueue[0];
    
    // STEP 1: Glow the Queue Node
    document.getElementById('flow-irq').classList.remove('glow-active');
    document.getElementById('flow-queue').classList.add('glow-active');
    renderQueue();

    const latency = parseInt(document.getElementById('latencySlider').value);
    
    // STEP 2: Wait half latency, then move glow to ISR
    await new Promise(r => setTimeout(r, latency / 2));
    document.getElementById('flow-queue').classList.remove('glow-active');
    document.getElementById('flow-isr').classList.add('glow-active');

    // STEP 3: Finish processing
    await new Promise(r => setTimeout(r, latency / 2));
    document.getElementById('flow-isr').classList.remove('glow-active');
    document.getElementById('flow-done').classList.add('glow-active');

    addLog(`I/O: Request from ${currentDevice.id.toUpperCase()} handled.`, "success");
    
    interruptQueue.shift();
    
    // Small delay for the "Done" state before repeating
    setTimeout(() => {
        document.getElementById('flow-done').classList.remove('glow-active');
        processNextInterrupt();
    }, 300);
}

// Modify manualTrigger to glow the first node immediately
function manualTrigger(deviceId) {
    const dev = drivers.find(d => d.id === deviceId);
    if (dev.status !== 'LOADED') return;

    document.getElementById('flow-irq').classList.add('glow-active');
    interruptQueue.push(dev);
    renderQueue();
    
    if (!isProcessing) processNextInterrupt();
}

renderDriverInventory();