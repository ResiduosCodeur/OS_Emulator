// ==========================================
// OS Boot Process Simulator
// ==========================================

class BootSimulator {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentStep = -1;
    this.speedMultiplier = 1;
    this.totalRam = 32; // MB
    this.usedRam = 0;
    this.processes = [];
    this.memoryState = {
      kernel: 0,
      drivers: 0,
      services: 0,
    };
    this.runId = 0;

    // Pause/resume mechanism using a promise resolver
    this._pauseResolve = null;
    this._delayTimeout = null;
    this._delayResolve = null;

    this.steps = [
      {
        name: "power-on",
        title: "Power On",
        duration: 2000,
        description:
          "CPU starts execution at fixed memory address 0xFFF0. No OS is running yet.",
        actions: [
          { type: "log", msg: "[CPU] Power-on self-test initiated" },
          { type: "log", msg: "[CPU] Execution begins at 0xFFF0" },
          { type: "log", msg: "[SYSTEM] Firmware initialization started" },
        ],
      },
      {
        name: "bios",
        title: "BIOS / UEFI",
        duration: 3000,
        description:
          "Hardware POST (Power-On Self-Test). Detects devices: RAM, Disk, Keyboard, etc.",
        actions: [
          { type: "log", msg: "[BIOS] Power-On Self Test (POST) started" },
          { type: "log", msg: "[BIOS] Testing RAM: 32MB ✔" },
          { type: "log", msg: "[BIOS] Disk detected ✔" },
          { type: "log", msg: "[BIOS] Keyboard/Mouse detected ✔" },
          { type: "log", msg: "[BIOS] Network card detected ✔" },
          { type: "log", msg: "[BIOS] All hardware tests passed" },
        ],
      },
      {
        name: "bootloader",
        title: "Bootloader",
        duration: 2500,
        description:
          "BIOS loads bootloader (GRUB) from disk MBR. Bootloader then loads kernel into memory.",
        actions: [
          { type: "log", msg: "[BIOS] Searching for bootable device..." },
          { type: "log", msg: "[BIOS] Loading bootloader from disk MBR" },
          { type: "transfer", block: "Boot", color: "orange", ramIndex: 0 },
          { type: "log", msg: "[BOOTLOADER] GRUB 2.0 initializing" },
          { type: "log", msg: "[BOOTLOADER] Loading kernel image into memory" },
          { type: "transfer", block: "Kernel", color: "blue", ramIndex: 1 },
        ],
      },
      {
        name: "kernel",
        title: "Kernel Load",
        duration: 3500,
        description:
          "Kernel initializes memory management, process scheduler, device drivers, and subsystems.",
        actions: [
          { type: "log", msg: "[KERNEL] Kernel decompression started" },
          { type: "transfer", block: "Drivers", color: "teal", ramIndex: 2 },
          { type: "memory", kernel: 8 },
          { type: "log", msg: "[KERNEL] Memory management initialized" },
          { type: "log", msg: "[KERNEL] Initializing device drivers" },
          { type: "memory", drivers: 4 },
          { type: "log", msg: "[KERNEL] Process scheduler initialized" },
          { type: "log", msg: "[KERNEL] Interrupt handlers registered" },
          { type: "log", msg: "[KERNEL] Kernel initialization complete" },
        ],
      },
      {
        name: "init",
        title: "Init System",
        duration: 3000,
        description:
          "First process (PID=1) starts and launches all essential system services.",
        actions: [
          { type: "log", msg: "[INIT] Starting systemd (PID=1)" },
          {
            type: "process",
            pid: 1,
            name: "systemd",
            status: "running",
            mem: 2,
          },
          { type: "log", msg: "[SYSTEMD] Mounting filesystems..." },
          { type: "transfer", block: "RootFS", color: "green", ramIndex: 3 },
          { type: "memory", services: 2 },
          { type: "log", msg: "[SYSTEMD] Starting network service (PID=245)" },
          {
            type: "process",
            pid: 245,
            name: "networking",
            status: "running",
            mem: 1,
          },
          { type: "log", msg: "[SYSTEMD] Starting SSH daemon (PID=312)" },
          {
            type: "process",
            pid: 312,
            name: "sshd",
            status: "running",
            mem: 1,
          },
          { type: "log", msg: "[SYSTEMD] Starting login manager (PID=389)" },
          {
            type: "process",
            pid: 389,
            name: "login",
            status: "running",
            mem: 1,
          },
        ],
      },
      {
        name: "userspace",
        title: "User Space Ready",
        duration: 2000,
        description:
          "System is now ready for user interaction. Login screen appears.",
        actions: [
          {
            type: "log",
            msg: "[SYSTEMD] All services initialized successfully",
          },
          { type: "log", msg: "[LOGIN] Display manager started" },
          { type: "process", pid: 456, name: "gdm", status: "running", mem: 2 },
          {
            type: "log",
            msg: "[SYSTEM] ╔══════════════════════════════════════╗",
          },
          {
            type: "log",
            msg: "[SYSTEM] ║       SYSTEM READY FOR LOGIN         ║",
          },
          {
            type: "log",
            msg: "[SYSTEM] ╚══════════════════════════════════════╝",
          },
          { type: "log", msg: "[SYSTEM] Boot completed successfully ✓" },
        ],
      },
    ];

    this.initEventListeners();
    this.updateStepNavigationControls();
  }

  initEventListeners() {
    document
      .getElementById("startBtn")
      .addEventListener("click", () => this.startBoot());
    document
      .getElementById("pauseBtn")
      .addEventListener("click", () => this.togglePause());
    document
      .getElementById("prevStepBtn")
      .addEventListener("click", () => this.previousStep());
    document
      .getElementById("nextStepBtn")
      .addEventListener("click", () => this.nextStep());
    document
      .getElementById("resetBtn")
      .addEventListener("click", () => this.reset());
    document
      .getElementById("clearLogBtn")
      .addEventListener("click", () => this.clearLog());
    document.getElementById("speedSlider").addEventListener("input", (e) => {
      this.speedMultiplier = parseFloat(e.target.value);
      document.getElementById("speedLabel").textContent =
        this.speedMultiplier.toFixed(1) + "x";
    });
  }

  async startBoot() {
    if (this.isRunning) return;
    this.reset();
    const runId = ++this.runId;
    this.isRunning = true;
    this.isPaused = false;
    document.getElementById("startBtn").disabled = true;
    document.getElementById("pauseBtn").disabled = false;
    document.getElementById("pauseBtn").textContent = "⏸ Pause";

    document.getElementById("pauseBtn").classList.remove("btn-paused");

    this.clearLog();

    for (let i = 0; i < this.steps.length; i++) {
      const shouldContinue = await this.executeStep(i, runId);
      if (!shouldContinue) return;
    }

    if (runId !== this.runId) return;
    this.isRunning = false;
    this.isPaused = false;
    document.getElementById("startBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("pauseBtn").textContent = "⏸ Pause";
    this.updateStepNavigationControls();
  }

  togglePause() {
    if (!this.isRunning) return;

    if (this.isPaused) {
      // Resume
      this.isPaused = false;
      document.getElementById("pauseBtn").textContent = "⏸ Pause";
      document.getElementById("pauseBtn").classList.remove("btn-paused");
      if (this._pauseResolve) {
        this._pauseResolve();
        this._pauseResolve = null;
      }
      this.addLog("[SYS] Simulation resumed");
    } else {
      // Pause
      this.isPaused = true;
      document.getElementById("pauseBtn").textContent = "▶ Resume";
      document.getElementById("pauseBtn").classList.add("btn-paused");
      this.addLog("[SYS] Simulation paused...");
    }
  }

  previousStep() {
    if (this.currentStep <= 0) return;
    this.goToStep(this.currentStep - 1);
  }

  nextStep() {
    const nextIndex = this.currentStep < 0 ? 0 : this.currentStep + 1;
    if (nextIndex >= this.steps.length) return;
    this.goToStep(nextIndex);
  }

  goToStep(index) {
    if (index < 0 || index >= this.steps.length) return;

    this.reset();
    this.currentStep = index;

    for (let i = 0; i <= index; i++) {
      for (let action of this.steps[i].actions) {
        this.applyActionInstant(action);
      }
    }

    this.updateStepper(index);
    this.updateStepDetails(this.steps[index]);
    this.updateStepNavigationControls();
  }

  // Waits until not paused
  async checkPause(runId) {
    if (this.isPaused) {
      await new Promise((resolve) => {
        this._pauseResolve = resolve;
      });
    }
    return runId === this.runId;
  }

  async executeStep(index, runId) {
    if (runId !== this.runId) return false;
    const step = this.steps[index];
    this.currentStep = index;

    this.updateStepper(index);
    this.updateStepDetails(step);

    const duration = step.duration / this.speedMultiplier;

    for (let action of step.actions) {
      if (!(await this.checkPause(runId))) return false;
      if (!(await this.executeAction(action, runId))) return false;
      if (!(await this.delay(duration / step.actions.length, runId))) {
        return false;
      }
    }
    return true;
  }

  async executeAction(action, runId) {
    if (runId !== this.runId) return false;
    switch (action.type) {
      case "log":
        this.addLog(action.msg);
        break;
      case "memory":
        this.updateMemory(action);
        break;
      case "process":
        this.addProcess(action);
        break;
      case "transfer":
        return await this.animateTransfer(action, runId);
    }
    return runId === this.runId;
  }

  applyActionInstant(action) {
    switch (action.type) {
      case "log":
        this.addLog(action.msg);
        break;
      case "memory":
        this.updateMemory(action);
        break;
      case "process":
        this.addProcess(action);
        break;
      case "transfer":
        this.renderTransferInstant(action);
        break;
    }
  }

  addLog(message) {
    const log = document.getElementById("systemLog");
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.textContent = message;

    if (
      message.includes("✔") ||
      message.includes("SUCCESS") ||
      message.includes("successfully")
    ) {
      entry.classList.add("success");
    } else if (message.includes("ERROR") || message.includes("FAILED")) {
      entry.classList.add("error");
    } else if (message.includes("SYSTEM READY") || message.includes("paused") || message.includes("resumed")) {
      entry.classList.add("warning");
    }

    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  updateMemory(data) {
    if (data.kernel !== undefined) this.memoryState.kernel = data.kernel;
    if (data.drivers !== undefined) this.memoryState.drivers = data.drivers;
    if (data.services !== undefined) this.memoryState.services = data.services;
    this.updateMemoryDisplay();
  }

  updateMemoryDisplay() {
    this.usedRam =
      this.memoryState.kernel +
      this.memoryState.drivers +
      this.memoryState.services;
    const freeRam = this.totalRam - this.usedRam;

    document.getElementById("memBlock-kernel").style.height =
      (this.memoryState.kernel / this.totalRam) * 200 + "px";
    document
      .getElementById("memBlock-kernel")
      .querySelector(".memory-size").textContent =
      this.memoryState.kernel + " MB";

    document.getElementById("memBlock-drivers").style.height =
      (this.memoryState.drivers / this.totalRam) * 200 + "px";
    document
      .getElementById("memBlock-drivers")
      .querySelector(".memory-size").textContent =
      this.memoryState.drivers + " MB";

    document.getElementById("memBlock-services").style.height =
      (this.memoryState.services / this.totalRam) * 200 + "px";
    document
      .getElementById("memBlock-services")
      .querySelector(".memory-size").textContent =
      this.memoryState.services + " MB";

    document
      .getElementById("memBlock-free")
      .querySelector(".memory-size").textContent = freeRam + " MB";

    document.getElementById("usedRam").textContent = this.usedRam + " MB";
    document.getElementById("freeRam").textContent = freeRam + " MB";

    const usage = ((this.usedRam / this.totalRam) * 100).toFixed(0);
    document.getElementById("memoryStatus").textContent = usage + "% Used";
  }

  addProcess(data) {
    this.processes.push(data);
    this.updateProcessTable();
  }

  updateProcessTable() {
    const table = document.getElementById("processTable");
    table.innerHTML = "";

    this.processes.forEach((proc) => {
      const row = document.createElement("div");
      row.className = "table-row";
      row.innerHTML = `
        <div class="col col-pid">${proc.pid}</div>
        <div class="col col-name">${proc.name}</div>
        <div class="col col-status"><span class="status-running">${proc.status}</span></div>
        <div class="col col-mem">${proc.mem} MB</div>
      `;
      table.appendChild(row);
    });

    document.getElementById("processCount").textContent = this.processes.length;
  }

  // ─── Animated disk → RAM transfer ───────────────────────────────────────────
  getTransferColor(color) {
    const colorMap = {
      orange: { bg: "rgba(232,140,60,0.25)", border: "#e88c3c", text: "#e88c3c" },
      blue: { bg: "rgba(74,157,232,0.25)", border: "#4a9de8", text: "#4a9de8" },
      teal: { bg: "rgba(56,190,160,0.25)", border: "#38bea0", text: "#38bea0" },
      green: { bg: "rgba(60,200,120,0.25)", border: "#3cc878", text: "#3cc878" },
    };

    return colorMap[color] || colorMap.blue;
  }

  renderTransferInstant(action) {
    const { block, color, ramIndex } = action;
    const c = this.getTransferColor(color);
    const ramBlocks = document.querySelectorAll(".ram-block");
    const target = ramBlocks[ramIndex % ramBlocks.length];

    target.textContent = block;
    target.style.background = c.bg;
    target.style.borderColor = c.border;
    target.style.color = c.text;
    target.classList.add("filled");

    document.getElementById("transferSpeed").textContent = "128 MB/s";
    document.getElementById("dataTransferred").textContent =
      (ramIndex + 1) * 4 + " MB";
    document.getElementById("diskStatus").textContent = "Done";
  }

  async animateTransfer(action, runId) {
    if (runId !== this.runId) return false;
    const { block, color, ramIndex } = action;

    const c = this.getTransferColor(color);

    // Highlight the source disk block
    const diskBlockMap = { Boot: 0, Kernel: 1, Drivers: 2, RootFS: 3 };
    const diskBlocks = document.querySelectorAll(".disk-block");
    const srcBlock = diskBlocks[diskBlockMap[block] ?? 0];
    srcBlock.classList.add("disk-block-active");

    // Show the transfer arrow pulsing
    const arrow = document.getElementById("transferArrow");
    arrow.classList.add("transfer-active");
    document.getElementById("diskStatus").textContent = "Transferring…";
    document.getElementById("transferSpeed").textContent = "128 MB/s";

    // Create the flying packet element
    const container = document.getElementById("transferTrack");
    const packet = document.createElement("div");
    packet.className = "transfer-packet";
    packet.textContent = block;
    packet.style.background = c.bg;
    packet.style.borderColor = c.border;
    packet.style.color = c.text;
    container.appendChild(packet);

    // Animate: left edge → right edge of the track
    // We use a CSS animation class for smooth movement
    requestAnimationFrame(() => {
      if (runId !== this.runId) return;
      packet.classList.add("fly");
    });

    // Wait for the animation to complete (~600ms)
    if (!(await this.delay(700 / this.speedMultiplier, runId))) {
      packet.remove();
      return false;
    }

    // Land the packet into the RAM block
    packet.remove();
    srcBlock.classList.remove("disk-block-active");
    arrow.classList.remove("transfer-active");

    const ramBlocks = document.querySelectorAll(".ram-block");
    const target = ramBlocks[ramIndex % ramBlocks.length];
    target.textContent = block;
    target.style.background = c.bg;
    target.style.borderColor = c.border;
    target.style.color = c.text;
    target.classList.add("filled", "ram-land");

    // Remove the landing animation class after it plays
    setTimeout(() => {
      if (runId === this.runId) target.classList.remove("ram-land");
    }, 400);

    const transferred = (ramIndex + 1) * 4;
    document.getElementById("dataTransferred").textContent = transferred + " MB";
    document.getElementById("diskStatus").textContent = "Done";
    return runId === this.runId;
  }
  // ────────────────────────────────────────────────────────────────────────────

  updateStepper(index) {
    document.querySelectorAll(".stepper-step").forEach((step) => {
      step.classList.remove("active", "completed");
    });

    for (let i = 0; i < index; i++) {
      const step = document.querySelector(
        `[data-step="${this.steps[i].name}"]`,
      );
      step.classList.add("completed");
      step.querySelector(".step-status").textContent = "✓";
    }

    const currentStepEl = document.querySelector(
      `[data-step="${this.steps[index].name}"]`,
    );
    currentStepEl.classList.add("active");
    currentStepEl.querySelector(".step-status").textContent = "●";
    this.updateStepNavigationControls();
  }

  updateStepDetails(step) {
    document.getElementById("detailTitle").textContent = step.title;
    document.getElementById("detailDesc").textContent = step.description;

    const timeline = document.getElementById("detailTimeline");
    timeline.innerHTML = "";

    const timelineItem = document.createElement("div");
    timelineItem.className = "timeline-item";
    timelineItem.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <strong>${step.title}</strong>
        <p>${step.description}</p>
        <div class="timeline-actions">
          ${step.actions
            .map((a) => {
              if (a.type === "log") {
                return `<code>${a.msg}</code>`;
              }
              return "";
            })
            .join("")}
        </div>
      </div>
    `;
    timeline.appendChild(timelineItem);
  }

  clearLog() {
    const log = document.getElementById("systemLog");
    log.innerHTML =
      '<div class="log-entry init">[SYS] Log cleared - awaiting boot sequence...</div>';
  }

  updateStepNavigationControls() {
    const prevBtn = document.getElementById("prevStepBtn");
    const nextBtn = document.getElementById("nextStepBtn");

    if (!prevBtn || !nextBtn) return;

    prevBtn.disabled = this.currentStep <= 0;
    nextBtn.disabled = this.currentStep >= this.steps.length - 1;
  }

  reset() {
    this.runId++;
    this.isRunning = false;
    this.isPaused = false;

    if (this._delayTimeout) {
      clearTimeout(this._delayTimeout);
      this._delayTimeout = null;
    }
    if (this._delayResolve) {
      this._delayResolve(false);
      this._delayResolve = null;
    }
    if (this._pauseResolve) {
      this._pauseResolve();
      this._pauseResolve = null;
    }

    this.currentStep = -1;
    this.usedRam = 0;
    this.processes = [];
    this.memoryState = { kernel: 0, drivers: 0, services: 0 };

    document.querySelectorAll(".stepper-step").forEach((step) => {
      step.classList.remove("active", "completed");
      step.querySelector(".step-status").textContent = "◯";
    });

    this.updateMemoryDisplay();
    document.getElementById("memoryStatus").textContent = "Empty";
    document.getElementById("processTable").innerHTML = "";
    document.getElementById("processCount").textContent = "0";

    document.querySelectorAll(".ram-block").forEach((block) => {
      block.textContent = "─";
      block.classList.remove("filled", "ram-land");
      block.removeAttribute("style");
    });

    document.querySelectorAll(".disk-block").forEach((b) =>
      b.classList.remove("disk-block-active")
    );

    document.getElementById("transferSpeed").textContent = "0 MB/s";
    document.getElementById("dataTransferred").textContent = "0 MB";
    document.getElementById("diskStatus").textContent = "Idle";
    document.getElementById("transferArrow").classList.remove("transfer-active");

    // Clear any flying packets
    const track = document.getElementById("transferTrack");
    if (track) track.innerHTML = "";

    document.getElementById("detailTitle").textContent = "Awaiting Boot Sequence";
    document.getElementById("detailDesc").textContent =
      'Click "Start Boot" to begin the simulation';
    document.getElementById("detailTimeline").innerHTML = "";

    this.clearLog();
    document.getElementById("startBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("pauseBtn").textContent = "⏸ Pause";
    document.getElementById("pauseBtn").classList.remove("btn-paused");
    this.updateStepNavigationControls();
  }

  delay(ms, runId) {
    if (runId !== undefined && runId !== this.runId) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this._delayResolve = resolve;
      this._delayTimeout = setTimeout(() => {
        this._delayTimeout = null;
        this._delayResolve = null;
        resolve(runId === undefined || runId === this.runId);
      }, ms);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new BootSimulator();
});
