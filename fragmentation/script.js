/* ================================================================
   Memory Fragmentation Simulator
   Demonstrates Internal & External Fragmentation
   Algorithms: First Fit | Best Fit | Worst Fit | Next Fit
   ================================================================ */

class FragmentationSimulator {
  constructor() {
    // Memory configuration
    this.totalMemory = 100;      // Total memory in KB
    this.partitionSize = 16;     // For fixed partition model
    this.memoryModel = 'variable'; // 'variable' or 'fixed'
    
    // Allocation algorithm
    this.algorithm = 'first';
    this.nextFitPointer = 0;     // For Next Fit algorithm
    
    // Process management
    this.processes = [];
    this.nextProcessId = 1;
    
    // Process colors for visualization
    this.processColors = [
      '#4a9de8', '#38bea0', '#b464e8', '#e88c3c', 
      '#3cc878', '#e85078', '#64a0e8', '#e8c83c', '#8c50e8'
    ];
    
    // Statistics
    this.stats = {
      searches: 0,  // For algorithm stats
      allocations: 0,
      deallocations: 0
    };
    
    this.initializeElements();
    this.attachEventListeners();
    this.render();
  }

  initializeElements() {
    // Configuration elements
    this.memModelSelect = document.getElementById('mem-model');
    this.totalMemoryInput = document.getElementById('total-memory');
    this.partitionSizeInput = document.getElementById('partition-size');
    this.partitionSizeGroup = document.getElementById('partition-size-group');
    
    // Algorithm radio buttons
    this.algoRadios = document.querySelectorAll('input[name="algo"]');
    
    // Process input elements
    this.processNameInput = document.getElementById('process-name');
    this.processSizeInput = document.getElementById('process-size');
    this.processSelect = document.getElementById('process-select');
    
    // Action buttons
    this.allocateBtn = document.getElementById('allocate-btn');
    this.deallocateBtn = document.getElementById('deallocate-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.addRandomBtn = document.getElementById('add-random-btn');
    this.addBatchBtn = document.getElementById('add-batch-btn');
    this.compactBtn = document.getElementById('compact-btn');
    
    // Display containers
    this.memoryBlocksContainer = document.getElementById('memory-blocks');
    this.processListContainer = document.getElementById('process-list');
    
    // Statistics elements
    this.statUsed = document.getElementById('stat-used');
    this.statFree = document.getElementById('stat-free');
    this.statInternal = document.getElementById('stat-internal');
    this.statExternal = document.getElementById('stat-external');
    this.utilizationPercent = document.getElementById('utilization-percent');
    this.utilizationBar = document.getElementById('utilization-bar');
    this.internalFragValue = document.getElementById('internal-frag-value');
    this.externalFragValue = document.getElementById('external-frag-value');
    this.currentAlgo = document.getElementById('current-algo');
    this.algoStats = document.getElementById('algo-stats');
    this.processCount = document.getElementById('process-count');
    
    // Log container
    this.logContainer = document.getElementById('log-container');
  }

  attachEventListeners() {
    // Memory model change
    this.memModelSelect.addEventListener('change', () => {
      this.memoryModel = this.memModelSelect.value;
      this.updatePartitionSizeVisibility();
      this.addLog('Memory model changed to: ' + (this.memoryModel === 'variable' ? 'Variable-sized' : 'Fixed-size') + ' partitions', 'info');
      this.render();
    });

    // Total memory change
    this.totalMemoryInput.addEventListener('change', () => {
      this.totalMemory = parseInt(this.totalMemoryInput.value) || 100;
      this.addLog('Total memory set to: ' + this.totalMemory + ' KB', 'info');
      this.render();
    });

    // Partition size change
    this.partitionSizeInput.addEventListener('change', () => {
      this.partitionSize = parseInt(this.partitionSizeInput.value) || 16;
      this.addLog('Partition size set to: ' + this.partitionSize + ' KB', 'info');
      this.render();
    });

    // Algorithm selection
    this.algoRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.algorithm = radio.value;
        this.nextFitPointer = 0;  // Reset Next Fit pointer
        this.addLog('Algorithm changed to: ' + this.getAlgorithmName(), 'info');
        this.stats.searches = 0;
        this.render();
      });
    });

    // Allocate button
    this.allocateBtn.addEventListener('click', () => {
      this.allocateProcess();
    });

    // Deallocate button
    this.deallocateBtn.addEventListener('click', () => {
      this.deallocateProcess();
    });

    // Clear button
    this.clearBtn.addEventListener('click', () => {
      this.clearAll();
    });

    // Random process button
    this.addRandomBtn.addEventListener('click', () => {
      this.addRandomProcess();
    });

    // Batch add button
    this.addBatchBtn.addEventListener('click', () => {
      this.addBatchProcesses();
    });

    // Compaction button
    this.compactBtn.addEventListener('click', () => {
      this.performCompaction();
    });

    // Enter key for process input
    this.processSizeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.allocateProcess();
      }
    });
  }

  updatePartitionSizeVisibility() {
    if (this.memoryModel === 'fixed') {
      this.partitionSizeGroup.style.display = 'block';
    } else {
      this.partitionSizeGroup.style.display = 'none';
    }
  }

  getAlgorithmName() {
    const names = {
      first: 'First Fit',
      best: 'Best Fit',
      worst: 'Worst Fit',
      next: 'Next Fit'
    };
    return names[this.algorithm] || 'First Fit';
  }

  // Allocate a new process
  allocateProcess() {
    const name = this.processNameInput.value.trim() || `P${this.nextProcessId}`;
    const size = parseInt(this.processSizeInput.value);
    
    if (!size || size <= 0) {
      this.addLog('Invalid process size', 'error');
      return;
    }

    if (size > this.totalMemory) {
      this.addLog(`Process size (${size}KB) exceeds total memory (${this.totalMemory}KB)`, 'error');
      return;
    }

    // Check if there's enough free memory
    const freeMemory = this.getFreeMemory();
    if (size > freeMemory) {
      this.addLog(`Not enough free memory: ${freeMemory}KB available, ${size}KB requested`, 'error');
      return;
    }

    // Find suitable block based on algorithm
    const block = this.findSuitableBlock(size);
    
    if (!block) {
      this.addLog('No suitable memory block found', 'error');
      return;
    }

    // Create process
    const process = {
      id: this.nextProcessId++,
      name: name,
      size: size,
      start: block.start,
      end: block.start + size - 1,
      color: this.processColors[(this.processes.length) % this.processColors.length]
    };

    this.processes.push(process);
    this.stats.allocations++;
    this.processes.sort((a, b) => a.start - b.start);
    
    this.addLog(`Allocated ${name} (${size}KB) at position ${block.start}`, 'success');
    
    // Auto-generate next process name
    this.processNameInput.value = `P${this.nextProcessId}`;
    this.processSizeInput.value = Math.floor(Math.random() * 20) + 5;
    
    this.render();
  }

  // Find suitable memory block based on algorithm
  findSuitableBlock(size) {
    const freeBlocks = this.getFreeBlocks();
    if (freeBlocks.length === 0) return null;

    this.stats.searches++;
    let selectedBlock = null;

    switch (this.algorithm) {
      case 'first':
        // First Fit: Find first block that's large enough
        for (const block of freeBlocks) {
          if (block.size >= size) {
            selectedBlock = block;
            break;
          }
        }
        break;

      case 'best':
        // Best Fit: Find smallest block that's large enough
        let minSize = Infinity;
        for (const block of freeBlocks) {
          if (block.size >= size && block.size < minSize) {
            minSize = block.size;
            selectedBlock = block;
          }
        }
        break;

      case 'worst':
        // Worst Fit: Find largest block
        let maxSize = -1;
        for (const block of freeBlocks) {
          if (block.size > maxSize) {
            maxSize = block.size;
            selectedBlock = block;
          }
        }
        break;

      case 'next':
        // Next Fit: Start searching from last allocation
        const n = freeBlocks.length;
        for (let i = 0; i < n; i++) {
          const idx = (this.nextFitPointer + i) % n;
          if (freeBlocks[idx].size >= size) {
            selectedBlock = freeBlocks[idx];
            this.nextFitPointer = (idx + 1) % n;
            break;
          }
        }
        // If not found from pointer, search from beginning
        if (!selectedBlock) {
          for (let i = 0; i < this.nextFitPointer; i++) {
            if (freeBlocks[i].size >= size) {
              selectedBlock = freeBlocks[i];
              this.nextFitPointer = i + 1;
              break;
            }
          }
        }
        break;
    }

    return selectedBlock;
  }

  // Get all free memory blocks
  getFreeBlocks() {
    const freeBlocks = [];
    let current = 0;

    // Sort processes by start position
    const sorted = [...this.processes].sort((a, b) => a.start - b.start);

    for (const process of sorted) {
      if (process.start > current) {
        freeBlocks.push({
          start: current,
          size: process.start - current
        });
      }
      current = process.end + 1;
    }

    // Check if there's free memory at the end
    if (current < this.totalMemory) {
      freeBlocks.push({
        start: current,
        size: this.totalMemory - current
      });
    }

    return freeBlocks;
  }

  // Get total free memory
  getFreeMemory() {
    return this.totalMemory - this.getUsedMemory();
  }

  // Get used memory
  getUsedMemory() {
    return this.processes.reduce((sum, p) => sum + p.size, 0);
  }

  // Calculate internal fragmentation
  getInternalFragmentation() {
    if (this.memoryModel === 'fixed') {
      // Internal frag = (partition size - actual process size) for each process
      return this.processes.reduce((sum, p) => {
        const internal = Math.max(0, this.partitionSize - p.size);
        return sum + internal;
      }, 0);
    }
    return 0;
  }

  // Calculate external fragmentation
  getExternalFragmentation() {
    if (this.memoryModel === 'fixed') {
      // External frag doesn't apply to fixed partition in the same way
      return 0;
    }
    
    // External fragmentation = sum of all free blocks
    // But only count blocks that are too small to be useful
    const freeBlocks = this.getFreeBlocks();
    return freeBlocks.reduce((sum, b) => sum + b.size, 0);
  }

  // Deallocate a process
  deallocateProcess() {
    const processId = this.processSelect.value;
    if (!processId) {
      this.addLog('Please select a process to deallocate', 'warning');
      return;
    }

    const id = parseInt(processId);
    const process = this.processes.find(p => p.id === id);
    
    if (process) {
      this.processes = this.processes.filter(p => p.id !== id);
      this.stats.deallocations++;
      this.addLog(`Deallocated ${process.name} (${process.size}KB)`, 'success');
      this.render();
    }
  }

  // Clear all processes
  clearAll() {
    if (this.processes.length === 0) {
      this.addLog('Memory already empty', 'info');
      return;
    }

    this.processes = [];
    this.nextProcessId = 1;
    this.nextFitPointer = 0;
    this.stats = { searches: 0, allocations: 0, deallocations: 0 };
    
    this.addLog('Memory cleared - all processes deallocated', 'warning');
    this.render();
  }

  // Add random process
  addRandomProcess() {
    const size = Math.floor(Math.random() * 25) + 5;
    this.processNameInput.value = `P${this.nextProcessId}`;
    this.processSizeInput.value = size;
    this.allocateProcess();
  }

  // Add batch processes
  addBatchProcesses() {
    const sizes = [15, 20, 12];
    let delay = 0;
    
    for (const size of sizes) {
      setTimeout(() => {
        this.processNameInput.value = `P${this.nextProcessId}`;
        this.processSizeInput.value = size;
        this.allocateProcess();
      }, delay);
      delay += 100;
    }
  }

  // Perform memory compaction
  performCompaction() {
    if (this.processes.length <= 1) {
      this.addLog('Compaction not needed - memory is already contiguous', 'info');
      return;
    }

    // Sort processes by start position
    const sorted = [...this.processes].sort((a, b) => a.start - b.start);
    
    let current = 0;
    const oldPositions = this.processes.map(p => ({ name: p.name, oldStart: p.start }));
    
    for (const process of sorted) {
      if (process.start !== current) {
        process.start = current;
        process.end = current + process.size - 1;
      }
      current = process.end + 1;
    }

    this.addLog('Memory compaction performed - all processes moved to contiguous positions', 'success');
    this.render();
  }

  // Render the memory visualization
  render() {
    this.renderMemoryBlocks();
    this.renderProcessList();
    this.updateStatistics();
    this.updateProcessSelect();
  }

  renderMemoryBlocks() {
    const container = this.memoryBlocksContainer;
    container.innerHTML = '';

    if (this.processes.length === 0) {
      // Show empty memory
      const block = document.createElement('div');
      block.className = 'memory-block';
      
      const segment = document.createElement('div');
      segment.className = 'block-segment free';
      segment.style.flex = '1';
      segment.innerHTML = '<span class="block-label">FREE</span><span class="block-size">' + this.totalMemory + ' KB</span>';
      
      block.appendChild(segment);
      container.appendChild(block);
      return;
    }

    // Sort processes by start position
    const sorted = [...this.processes].sort((a, b) => a.start - b.start);
    
    let current = 0;
    
    for (const process of sorted) {
      // Add free space before this process
      if (process.start > current) {
        const freeSize = process.start - current;
        const block = document.createElement('div');
        block.className = 'memory-block';
        
        const segment = document.createElement('div');
        segment.className = 'block-segment free';
        segment.style.flex = freeSize;
        segment.innerHTML = '<span class="block-label">FREE</span><span class="block-size">' + freeSize + ' KB</span>';
        
        block.appendChild(segment);
        container.appendChild(block);
      }
      
      // Add allocated process block
      const processBlock = document.createElement('div');
      processBlock.className = 'memory-block';
      
      const allocatedSegment = document.createElement('div');
      allocatedSegment.className = 'block-segment allocated';
      allocatedSegment.style.flex = process.size;
      allocatedSegment.style.background = `linear-gradient(135deg, ${process.color} 0%, ${this.darkenColor(process.color)} 100%)`;
      allocatedSegment.innerHTML = `<span class="block-label">${process.name}</span><span class="block-size">${process.size} KB</span>`;
      
      processBlock.appendChild(allocatedSegment);
      container.appendChild(processBlock);
      
      current = process.end + 1;
    }

    // Add remaining free space at the end
    if (current < this.totalMemory) {
      const freeSize = this.totalMemory - current;
      const block = document.createElement('div');
      block.className = 'memory-block';
      
      const segment = document.createElement('div');
      segment.className = 'block-segment free';
      segment.style.flex = freeSize;
      segment.innerHTML = '<span class="block-label">FREE</span><span class="block-size">' + freeSize + ' KB</span>';
      
      block.appendChild(segment);
      container.appendChild(block);
    }
  }

  renderProcessList() {
    const container = this.processListContainer;
    container.innerHTML = '';

    if (this.processes.length === 0) {
      container.innerHTML = '<div style="color: var(--blue-200); font-size: 11px; text-align: center; padding: 20px;">No processes allocated</div>';
      return;
    }

    // Sort by start position
    const sorted = [...this.processes].sort((a, b) => a.start - b.start);

    for (const process of sorted) {
      const card = document.createElement('div');
      card.className = 'process-card';
      
      const internalFrag = this.memoryModel === 'fixed' ? Math.max(0, this.partitionSize - process.size) : 0;
      
      card.innerHTML = `
        <div class="process-info">
          <div class="process-name" style="color: ${process.color}">${process.name}</div>
          <div class="process-size">${process.size} KB @ ${process.start}</div>
          ${internalFrag > 0 ? `<div class="process-frag">Internal: ${internalFrag} KB</div>` : ''}
        </div>
        <div class="process-actions">
          <button class="process-btn remove" onclick="simulator.removeProcess(${process.id})" title="Remove">✕</button>
        </div>
      `;
      
      container.appendChild(card);
    }
  }

  removeProcess(id) {
    const process = this.processes.find(p => p.id === id);
    if (process) {
      this.processes = this.processes.filter(p => p.id !== id);
      this.stats.deallocations++;
      this.addLog(`Deallocated ${process.name} (${process.size}KB)`, 'success');
      this.render();
    }
  }

  updateStatistics() {
    const used = this.getUsedMemory();
    const free = this.getFreeMemory();
    const internal = this.getInternalFragmentation();
    const external = this.getExternalFragmentation();
    const utilization = this.totalMemory > 0 ? (used / this.totalMemory) * 100 : 0;

    // Update header stats
    this.statUsed.textContent = used + ' KB';
    this.statFree.textContent = free + ' KB';
    this.statInternal.textContent = internal + ' KB';
    this.statExternal.textContent = external + ' KB';

    // Update stat cards
    this.utilizationPercent.textContent = Math.round(utilization) + '%';
    this.utilizationBar.style.width = utilization + '%';
    this.internalFragValue.textContent = internal + ' KB';
    this.externalFragValue.textContent = external + ' KB';
    this.currentAlgo.textContent = this.getAlgorithmName();
    this.algoStats.textContent = `Searches: ${this.stats.searches}`;
    this.processCount.textContent = this.processes.length;
  }

  updateProcessSelect() {
    this.processSelect.innerHTML = '<option value="">-- Select Process --</option>';
    
    const sorted = [...this.processes].sort((a, b) => a.start - b.start);
    
    for (const process of sorted) {
      const option = document.createElement('option');
      option.value = process.id;
      option.textContent = `${process.name} (${process.size}KB @ ${process.start})`;
      this.processSelect.appendChild(option);
    }
  }

  addLog(message, type = 'info') {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-message ${type}">${message}</span>
    `;
    
    this.logContainer.insertBefore(entry, this.logContainer.firstChild);
    
    // Keep only last 50 entries
    while (this.logContainer.children.length > 50) {
      this.logContainer.removeChild(this.logContainer.lastChild);
    }
  }

  darkenColor(hex) {
    // Simple color darkening function
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    const darkR = Math.max(0, Math.floor(r * 0.5));
    const darkG = Math.max(0, Math.floor(g * 0.5));
    const darkB = Math.max(0, Math.floor(b * 0.5));
    
    return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
  }
}

// Initialize simulator when DOM is ready
let simulator;

document.addEventListener('DOMContentLoaded', () => {
  simulator = new FragmentationSimulator();
  
  // Add initial log entry
  simulator.addLog('Memory Fragmentation Simulator initialized', 'info');
  simulator.addLog('Total memory: 100 KB | Algorithm: First Fit', 'info');
});