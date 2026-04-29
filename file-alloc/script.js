// File Allocation Simulator
class FileAllocationSimulator {
  constructor() {
    this.allocations = [];
    this.diskSize = 20;
    this.files = [];
    this.nextFileColorIndex = 0;
    this.blockColors = [
      "file-1",
      "file-2",
      "file-3",
      "file-4",
      "file-5",
      "file-6",
      "file-7",
    ];

    this.initializeElements();
    this.attachEventListeners();
    this.updateMethodDescription();
    this.updateMethodUI();
  }

  initializeElements() {
    this.methodSelect = document.getElementById("alloc-method");
    this.diskSizeInput = document.getElementById("disk-size");
    this.fileNameInput = document.getElementById("file-name");
    this.fileSizeInput = document.getElementById("file-size");
    this.simulateBtn = document.getElementById("simulate-btn");
    this.clearBtn = document.getElementById("clear-btn");
    this.diskBlocksContainer = document.getElementById("disk-blocks");
    this.allocationInfoDiv = document.getElementById("allocation-info");
    this.allocationOutputDiv = document.getElementById("allocation-output");
    this.methodDescriptionDiv = document.getElementById("method-description");

    // Dynamic UI panels
    this.linkedPanel = document.getElementById("linked-panel");
    this.indexedPanel = document.getElementById("indexed-panel");

    // Linked controls
    this.linkedModeRandom = document.getElementById("linked-mode-random");
    this.linkedModeManual = document.getElementById("linked-mode-manual");
    this.linkedRandomizeBtn = document.getElementById("linked-randomize-btn");
    this.linkedBlocksInput = document.getElementById("linked-blocks-input");
    this.linkedManualSection = document.getElementById("linked-manual-section");

    // Indexed controls
    this.indexedModeRandom = document.getElementById("indexed-mode-random");
    this.indexedModeManual = document.getElementById("indexed-mode-manual");
    this.indexedRandomizeBtn = document.getElementById("indexed-randomize-btn");
    this.indexedBlockInput = document.getElementById("indexed-index-block");
    this.indexedDataInput = document.getElementById("indexed-data-input");
    this.indexedManualSection = document.getElementById("indexed-manual-section");
  }

  attachEventListeners() {
    this.simulateBtn.addEventListener("click", () => this.runSimulation());
    this.clearBtn.addEventListener("click", () => this.clearSimulation());
    this.methodSelect.addEventListener("change", () => {
      this.updateMethodDescription();
      this.updateMethodUI();
    });

    // Linked mode toggles
    this.linkedModeRandom.addEventListener("change", () => this.updateLinkedUI());
    this.linkedModeManual.addEventListener("change", () => this.updateLinkedUI());
    this.linkedRandomizeBtn.addEventListener("click", () => this.randomizeLinkedBlocks());

    // Indexed mode toggles
    this.indexedModeRandom.addEventListener("change", () => this.updateIndexedUI());
    this.indexedModeManual.addEventListener("change", () => this.updateIndexedUI());
    this.indexedRandomizeBtn.addEventListener("click", () => this.randomizeIndexedBlocks());

    // Update file size when disk size changes
    this.diskSizeInput.addEventListener("change", () => {
      this.fileSizeInput.max = this.diskSizeInput.value;
    });
  }

  updateMethodUI() {
    const method = this.methodSelect.value;
    this.linkedPanel.style.display = method === "linked" ? "block" : "none";
    this.indexedPanel.style.display = method === "indexed" ? "block" : "none";
  }

  updateLinkedUI() {
    const isManual = this.linkedModeManual.checked;
    this.linkedManualSection.style.display = isManual ? "block" : "none";
    this.linkedRandomizeBtn.style.display = isManual ? "none" : "inline-flex";
  }

  updateIndexedUI() {
    const isManual = this.indexedModeManual.checked;
    this.indexedManualSection.style.display = isManual ? "block" : "none";
    this.indexedRandomizeBtn.style.display = isManual ? "none" : "inline-flex";
  }

  randomizeLinkedBlocks() {
    const fileSize = parseInt(this.fileSizeInput.value) || 4;
    const diskSize = parseInt(this.diskSizeInput.value) || 20;
    const usedBlocks = this.getAllUsedBlocks();

    const available = [];
    for (let i = 0; i < diskSize; i++) {
      if (!usedBlocks.has(i)) available.push(i);
    }

    if (available.length < fileSize) {
      this.showToast(`Only ${available.length} free blocks available`, "error");
      return;
    }

    // Shuffle and pick fileSize blocks
    const shuffled = this.shuffleArray([...available]);
    const picked = shuffled.slice(0, fileSize).sort((a, b) => a - b);

    this.linkedBlocksInput.value = picked.join(", ");
    this.showToast(`Randomized ${fileSize} blocks: ${picked.join(", ")}`, "success");
  }

  randomizeIndexedBlocks() {
    const fileSize = parseInt(this.fileSizeInput.value) || 4;
    const diskSize = parseInt(this.diskSizeInput.value) || 20;
    const usedBlocks = this.getAllUsedBlocks();

    const available = [];
    for (let i = 0; i < diskSize; i++) {
      if (!usedBlocks.has(i)) available.push(i);
    }

    // Need fileSize data blocks + 1 index block
    if (available.length < fileSize + 1) {
      this.showToast(`Need ${fileSize + 1} free blocks, only ${available.length} available`, "error");
      return;
    }

    const shuffled = this.shuffleArray([...available]);
    const indexBlock = shuffled[0];
    const dataBlocks = shuffled.slice(1, fileSize + 1).sort((a, b) => a - b);

    this.indexedBlockInput.value = indexBlock;
    this.indexedDataInput.value = dataBlocks.join(", ");
    this.showToast(`Index block: ${indexBlock}, Data: ${dataBlocks.join(", ")}`, "success");
  }

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  getAllUsedBlocks() {
    const used = new Set();
    for (const file of this.files) {
      file.blocks.forEach(b => used.add(b));
      if (file.method === "indexed" && file.indexBlock !== undefined) {
        used.add(file.indexBlock);
      }
    }
    return used;
  }

  showToast(message, type = "info") {
    const existing = document.querySelector(".toast-msg");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `toast-msg toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("toast-visible"));
    setTimeout(() => {
      toast.classList.remove("toast-visible");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  runSimulation() {
    const method = this.methodSelect.value;
    const diskSize = parseInt(this.diskSizeInput.value);
    const fileName = this.fileNameInput.value.trim();
    const fileSize = parseInt(this.fileSizeInput.value);

    if (!fileName) {
      this.showToast("Please enter a file name", "error");
      return;
    }
    if (fileSize <= 0) {
      this.showToast("File size must be greater than 0", "error");
      return;
    }
    if (fileSize > diskSize) {
      this.showToast(`File size cannot exceed disk size (${diskSize} blocks)`, "error");
      return;
    }

    // Check duplicate file name
    if (this.files.find(f => f.name === fileName)) {
      this.showToast(`File "${fileName}" already exists`, "error");
      return;
    }

    this.diskSize = diskSize;
    this.nextFileColorIndex = this.files.length;

    switch (method) {
      case "contiguous":
        this.simulateContiguous(fileName, fileSize);
        break;
      case "linked":
        this.simulateLinked(fileName, fileSize);
        break;
      case "indexed":
        this.simulateIndexed(fileName, fileSize);
        break;
    }

    this.visualizeDisk();
    this.displayAllocationInfo();
  }

  simulateContiguous(fileName, fileSize) {
    let freeBlocks = [];
    let currentStart = -1;
    let currentLength = 0;

    for (let i = 0; i < this.diskSize; i++) {
      if (!this.isBlockAllocated(i)) {
        if (currentStart === -1) {
          currentStart = i;
          currentLength = 1;
        } else {
          currentLength++;
        }
        if (currentLength === fileSize) {
          freeBlocks = this.createBlockRange(currentStart, fileSize);
          break;
        }
      } else {
        currentStart = -1;
        currentLength = 0;
      }
    }

    if (freeBlocks.length === 0) {
      this.addOutput("error", `✗ Failed: Not enough contiguous blocks for ${fileName}`);
      return;
    }

    const file = {
      name: fileName,
      size: fileSize,
      blocks: freeBlocks,
      startBlock: freeBlocks[0],
      endBlock: freeBlocks[freeBlocks.length - 1],
      color: this.blockColors[this.nextFileColorIndex % this.blockColors.length],
      method: "contiguous",
    };

    this.files.push(file);
    this.allocations.push(file);

    this.addOutput("success", `✓ Contiguous Allocation Successful`);
    this.addOutput("info", `File: ${fileName}`);
    this.addOutput("info", `Size: ${fileSize} blocks`);
    this.addOutput("info", `Start Block: ${file.startBlock}`);
    this.addOutput("info", `End Block: ${file.endBlock}`);
    this.addOutput("info", `Blocks Allocated: ${freeBlocks.join(", ")}`);
    this.addOutput("info", "---");
  }

  simulateLinked(fileName, fileSize) {
    const usedBlocks = this.getAllUsedBlocks();
    let blocks;

    if (this.linkedModeManual.checked) {
      // Manual mode — parse user input
      const rawInput = this.linkedBlocksInput.value.trim();
      if (!rawInput) {
        this.showToast("Please enter block numbers or use Randomize", "error");
        return;
      }
      blocks = this.parseBlockList(rawInput);
      if (!blocks) return;

      if (blocks.length !== fileSize) {
        this.showToast(`You entered ${blocks.length} block(s) but file size is ${fileSize}`, "error");
        return;
      }

      // Validate blocks
      for (const b of blocks) {
        if (b < 0 || b >= this.diskSize) {
          this.showToast(`Block ${b} is out of range (0–${this.diskSize - 1})`, "error");
          return;
        }
        if (usedBlocks.has(b)) {
          this.showToast(`Block ${b} is already allocated`, "error");
          return;
        }
      }
    } else {
      // Auto-random mode
      if (this.linkedBlocksInput.value.trim()) {
        // If randomize was clicked, use those blocks
        blocks = this.parseBlockList(this.linkedBlocksInput.value);
        if (!blocks || blocks.length !== fileSize) {
          blocks = null;
        }
      }

      if (!blocks) {
        // Generate random blocks automatically
        const available = [];
        for (let i = 0; i < this.diskSize; i++) {
          if (!usedBlocks.has(i)) available.push(i);
        }
        if (available.length < fileSize) {
          this.addOutput("error", `✗ Failed: Not enough free blocks for ${fileName}`);
          return;
        }
        blocks = this.shuffleArray([...available]).slice(0, fileSize);
      }
    }

    // Build linked list
    const linkedList = {};
    blocks.forEach((block, index) => {
      linkedList[block] = index < blocks.length - 1 ? blocks[index + 1] : -1;
    });

    const file = {
      name: fileName,
      size: fileSize,
      blocks: blocks,
      startBlock: blocks[0],
      endBlock: blocks[blocks.length - 1],
      linkedList: linkedList,
      color: this.blockColors[this.nextFileColorIndex % this.blockColors.length],
      method: "linked",
    };

    this.files.push(file);
    this.allocations.push(file);

    this.addOutput("success", `✓ Linked Allocation Successful`);
    this.addOutput("info", `File: ${fileName}`);
    this.addOutput("info", `Size: ${fileSize} blocks`);
    this.addOutput("info", `Start Block: ${file.startBlock}`);
    this.addOutput("info", `Block Order: ${blocks.join(" → ")}`);
    this.addOutput("info", `Linked List Pointers:`);
    blocks.forEach((block) => {
      const next = linkedList[block] === -1 ? "NULL" : linkedList[block];
      this.addOutput("info", `  Block ${block} → ${next}`);
    });
    this.addOutput("info", "---");

    // Clear randomized preview after use
    if (!this.linkedModeManual.checked) {
      this.linkedBlocksInput.value = "";
    }
  }

  simulateIndexed(fileName, fileSize) {
    const usedBlocks = this.getAllUsedBlocks();
    let indexBlock, dataBlocks;

    if (this.indexedModeManual.checked) {
      // Manual mode
      const rawIndex = this.indexedBlockInput.value.trim();
      const rawData = this.indexedDataInput.value.trim();

      if (!rawIndex || !rawData) {
        this.showToast("Please fill in both index block and data blocks", "error");
        return;
      }

      indexBlock = parseInt(rawIndex);
      if (isNaN(indexBlock) || indexBlock < 0 || indexBlock >= this.diskSize) {
        this.showToast(`Index block must be between 0 and ${this.diskSize - 1}`, "error");
        return;
      }
      if (usedBlocks.has(indexBlock)) {
        this.showToast(`Index block ${indexBlock} is already allocated`, "error");
        return;
      }

      dataBlocks = this.parseBlockList(rawData);
      if (!dataBlocks) return;

      if (dataBlocks.length !== fileSize) {
        this.showToast(`You entered ${dataBlocks.length} data block(s) but file size is ${fileSize}`, "error");
        return;
      }

      const allBlocks = [indexBlock, ...dataBlocks];
      const seen = new Set();
      for (const b of allBlocks) {
        if (b < 0 || b >= this.diskSize) {
          this.showToast(`Block ${b} is out of range (0–${this.diskSize - 1})`, "error");
          return;
        }
        if (usedBlocks.has(b)) {
          this.showToast(`Block ${b} is already allocated`, "error");
          return;
        }
        if (seen.has(b)) {
          this.showToast(`Duplicate block ${b} in input`, "error");
          return;
        }
        seen.add(b);
      }
    } else {
      // Auto-random mode
      if (this.indexedBlockInput.value.trim() && this.indexedDataInput.value.trim()) {
        indexBlock = parseInt(this.indexedBlockInput.value.trim());
        dataBlocks = this.parseBlockList(this.indexedDataInput.value);
        if (!dataBlocks || dataBlocks.length !== fileSize || isNaN(indexBlock)) {
          indexBlock = null;
          dataBlocks = null;
        }
      }

      if (!indexBlock && indexBlock !== 0) {
        const available = [];
        for (let i = 0; i < this.diskSize; i++) {
          if (!usedBlocks.has(i)) available.push(i);
        }
        if (available.length < fileSize + 1) {
          this.addOutput("error", `✗ Failed: Not enough free blocks for ${fileName} (need ${fileSize + 1})`);
          return;
        }
        const shuffled = this.shuffleArray([...available]);
        indexBlock = shuffled[0];
        dataBlocks = shuffled.slice(1, fileSize + 1);
      }
    }

    const file = {
      name: fileName,
      size: fileSize,
      blocks: dataBlocks,
      indexBlock: indexBlock,
      color: this.blockColors[this.nextFileColorIndex % this.blockColors.length],
      method: "indexed",
    };

    this.files.push(file);
    this.allocations.push(file);

    this.addOutput("success", `✓ Indexed Allocation Successful`);
    this.addOutput("info", `File: ${fileName}`);
    this.addOutput("info", `Size: ${fileSize} blocks`);
    this.addOutput("info", `Index Block: ${indexBlock}`);
    this.addOutput("info", `Data Blocks: ${dataBlocks.join(", ")}`);
    this.addOutput("info", `Index Block Contents:`);
    dataBlocks.forEach((block, index) => {
      this.addOutput("info", `  Index[${index}] → Block ${block}`);
    });
    this.addOutput("info", "---");

    // Clear randomized preview after use
    if (!this.indexedModeManual.checked) {
      this.indexedBlockInput.value = "";
      this.indexedDataInput.value = "";
    }
  }

  parseBlockList(input) {
    const parts = input.split(/[\s,]+/).filter(Boolean);
    const blocks = [];
    for (const p of parts) {
      const n = parseInt(p);
      if (isNaN(n)) {
        this.showToast(`"${p}" is not a valid block number`, "error");
        return null;
      }
      blocks.push(n);
    }
    return blocks;
  }

  visualizeDisk() {
    this.diskBlocksContainer.innerHTML = "";

    for (let i = 0; i < this.diskSize; i++) {
      const block = document.createElement("div");
      block.className = "disk-block";

      let allocated = false;
      let label = String(i);
      let titleText = `Free block ${i}`;

      for (const file of this.files) {
        if (file.method === "indexed" && file.indexBlock === i) {
          block.classList.add("allocated", "index-block", file.color);
          label = `IDX`;
          titleText = `Index block for "${file.name}"`;
          allocated = true;
          break;
        }
        if (file.blocks.includes(i)) {
          block.classList.add("allocated", file.color);
          const pos = file.blocks.indexOf(i);

          if (file.method === "linked") {
            const next = file.linkedList[i];
            label = next === -1 ? `${i}\n↓NULL` : `${i}\n↓${next}`;
            block.dataset.pointer = next === -1 ? "NULL" : `→${next}`;
            titleText = `Block ${i} of "${file.name}" → ${next === -1 ? "NULL" : next}`;
          } else {
            label = String(i);
            titleText = `Block ${i} of "${file.name}" (pos ${pos})`;
          }
          allocated = true;
          break;
        }
      }

      if (!allocated) {
        block.classList.add("free");
        label = "F";
      }

      // Inner structure
      block.innerHTML = `
        <span class="block-num">${i}</span>
        ${allocated ? `<span class="block-tag">${this.getBlockTag(i)}</span>` : '<span class="block-free-label">FREE</span>'}
      `;
      block.title = titleText;
      this.diskBlocksContainer.appendChild(block);
    }
  }

  getBlockTag(blockNum) {
    for (const file of this.files) {
      if (file.method === "indexed" && file.indexBlock === blockNum) {
        return `IDX`;
      }
      if (file.blocks.includes(blockNum)) {
        if (file.method === "linked") {
          const next = file.linkedList[blockNum];
          return next === -1 ? "→NULL" : `→${next}`;
        }
        return file.name.slice(0, 3).toUpperCase();
      }
    }
    return "";
  }

  displayAllocationInfo() {
    this.allocationInfoDiv.innerHTML = "";

    if (this.files.length === 0) {
      this.allocationInfoDiv.innerHTML =
        '<p style="color: rgba(200, 223, 245, 0.6);">No files allocated yet</p>';
      return;
    }

    const totalAllocated = this.files.reduce((sum, file) => {
      let count = file.blocks.length;
      if (file.method === "indexed") count += 1; // index block
      return sum + count;
    }, 0);
    const totalFree = this.diskSize - totalAllocated;

    this.allocationInfoDiv.innerHTML = `
      <div class="info-card">
        <div class="info-label">Total Disk Blocks</div>
        <div class="info-value">${this.diskSize}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Allocated Blocks</div>
        <div class="info-value">${totalAllocated}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Free Blocks</div>
        <div class="info-value">${totalFree}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Files Allocated</div>
        <div class="info-value">${this.files.length}</div>
      </div>
    `;
  }

  addOutput(type, message) {
    const line = document.createElement("div");
    line.className = `output-line ${type}`;
    line.textContent = message;
    this.allocationOutputDiv.appendChild(line);
    this.allocationOutputDiv.parentElement.scrollTop =
      this.allocationOutputDiv.parentElement.scrollHeight;
  }

  updateMethodDescription() {
    const method = this.methodSelect.value;
    let description = "";

    switch (method) {
      case "contiguous":
        description = `
          <div class="description-header">Contiguous Allocation</div>
          <div class="description-content">
            <p>Each file occupies a set of contiguous (adjacent) blocks on the disk.</p>
            <div class="description-point">Blocks are stored consecutively with no gaps</div>
            <div class="description-point">Directory entry stores: starting block address + file length</div>
            <div class="description-point">Fast access — direct block calculation: b, b+1, b+2, ... b+n-1</div>
            <div class="description-point">Disadvantage: External fragmentation over time</div>
            <div class="description-point">Example: File of 4 blocks at start block 2 → blocks 2, 3, 4, 5</div>
          </div>
        `;
        break;
      case "linked":
        description = `
          <div class="description-header">Linked Allocation</div>
          <div class="description-content">
            <p>Each file is a linked list of disk blocks scattered anywhere on the disk.</p>
            <div class="description-point">Blocks can be non-contiguous — scattered freely</div>
            <div class="description-point">Each block holds a pointer to the next block in the file</div>
            <div class="description-point">Last block pointer = -1 / NULL (end of file)</div>
            <div class="description-point">Directory entry stores start and end block pointers</div>
            <div class="description-point">Advantage: No external fragmentation</div>
            <div class="description-point">Disadvantage: Random access is slow; pointer overhead per block</div>
            <div class="description-point">Use <strong>Randomize</strong> or enter custom block order (e.g. 3, 11, 7, 2)</div>
          </div>
        `;
        break;
      case "indexed":
        description = `
          <div class="description-header">Indexed Allocation</div>
          <div class="description-content">
            <p>A dedicated index block holds pointers to all data blocks of a file.</p>
            <div class="description-point">Each file has exactly one index block</div>
            <div class="description-point">Index[i] = disk address of the ith file block</div>
            <div class="description-point">Directory entry contains only the index block address</div>
            <div class="description-point">Supports efficient random access</div>
            <div class="description-point">Disadvantage: Extra space for index block; file size limited by block size</div>
            <div class="description-point">Use <strong>Randomize</strong> or manually specify index + data blocks</div>
          </div>
        `;
        break;
    }

    this.methodDescriptionDiv.innerHTML = description;
  }

  isBlockAllocated(blockNum) {
    for (const file of this.files) {
      if (file.blocks.includes(blockNum)) return true;
      if (file.method === "indexed" && file.indexBlock === blockNum) return true;
    }
    return false;
  }

  createBlockRange(start, length) {
    const blocks = [];
    for (let i = 0; i < length; i++) blocks.push(start + i);
    return blocks;
  }

  clearSimulation() {
    this.files = [];
    this.allocations = [];
    this.allocationOutputDiv.innerHTML = "";
    this.diskBlocksContainer.innerHTML = "";
    this.allocationInfoDiv.innerHTML = "";
    this.nextFileColorIndex = 0;

    this.fileNameInput.value = "file1";
    this.fileSizeInput.value = "4";
    this.diskSizeInput.value = "20";
    this.methodSelect.value = "contiguous";

    // Reset linked panel
    this.linkedModeRandom.checked = true;
    this.linkedBlocksInput.value = "";
    this.linkedManualSection.style.display = "none";
    this.linkedRandomizeBtn.style.display = "inline-flex";

    // Reset indexed panel
    this.indexedModeRandom.checked = true;
    this.indexedBlockInput.value = "";
    this.indexedDataInput.value = "";
    this.indexedManualSection.style.display = "none";
    this.indexedRandomizeBtn.style.display = "inline-flex";

    this.updateMethodDescription();
    this.updateMethodUI();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new FileAllocationSimulator();
});