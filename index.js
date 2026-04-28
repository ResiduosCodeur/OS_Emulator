/* ─── OS_EMULATOR · index.js ─── */

/* ── Team data ── */
const TEAM = [
  ["Sachin Rohra",                  "241CS251"],
  ["Samarth Talawar",               "241CS252"],
  ["Sannapuri Rohit",               "241CS253"],
  ["Reedham Shah",                  "241CS254"],
  ["Shivam Kumar",                  "241CS255"],
  ["John Vesli",                    "241CS256"],
  ["Somyak Priyadarshi Mohanta",    "241CS257"],
  ["Sona Tudu",                     "241CS258"],
  ["Srikarthik Sankarkumar",        "241CS260"],
];

/* Accent palette for avatars */
const AVATAR_COLORS = [
  ["rgba(74,157,232,0.18)",  "#4a9de8"],
  ["rgba(56,190,160,0.18)",  "#38bea0"],
  ["rgba(180,100,232,0.18)", "#b464e8"],
  ["rgba(232,140,60,0.18)",  "#e88c3c"],
  ["rgba(60,200,120,0.18)",  "#3cc878"],
  ["rgba(232,80,120,0.18)",  "#e85078"],
  ["rgba(100,160,232,0.18)", "#64a0e8"],
  ["rgba(232,200,60,0.18)",  "#e8c83c"],
  ["rgba(140,80,232,0.18)",  "#8c50e8"],
  ["rgba(60,220,200,0.18)",  "#3cdcc8"],
];

/* ── Render team grid ── */
function renderTeam() {
  const grid = document.getElementById("team-grid");
  if (!grid) return;

  TEAM.forEach(([name, id], i) => {
    const initials = name
      .split(" ")
      .map(w => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";

    const [bg, color] = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const displayName = name || "—";

    const card = document.createElement("div");
    card.className = "contrib";
    card.style.setProperty("--avatar-bg", bg);
    card.style.setProperty("--avatar-color", color);

    card.innerHTML = `
      <div class="avatar">${initials}</div>
      <div class="c-info">
        <div class="c-name">${displayName}</div>
        <div class="c-id">${id}</div>
      </div>
    `;

    grid.appendChild(card);
  });
}

/* ── Hero canvas animation: floating nodes + connecting lines ── */
function initHeroCanvas() {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W, H, nodes;

  const NODE_COUNT = 38;
  const CONNECT_DIST = 140;
  const COLOR_NODE  = "rgba(74,157,232,";
  const COLOR_LINE  = "rgba(74,157,232,";

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function spawnNodes() {
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r:  Math.random() * 1.8 + 0.8,
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* subtle radial glow at centre */
    const grd = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W,H) * 0.55);
    grd.addColorStop(0, "rgba(74,157,232,0.055)");
    grd.addColorStop(1, "rgba(74,157,232,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    const t = performance.now() * 0.001;

    /* Lines */
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < CONNECT_DIST) {
          const alpha = (1 - d / CONNECT_DIST) * 0.22;
          ctx.beginPath();
          ctx.strokeStyle = COLOR_LINE + alpha + ")";
          ctx.lineWidth = 0.7;
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    /* Nodes */
    nodes.forEach(n => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.1 + n.pulse);
      const alpha = 0.35 + 0.45 * pulse;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + pulse * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_NODE + alpha + ")";
      ctx.fill();

      /* tiny glow ring on some nodes */
      if (n.r > 1.9) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 4 + pulse * 3, 0, Math.PI * 2);
        ctx.strokeStyle = COLOR_NODE + (alpha * 0.18) + ")";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    });
  }

  function update() {
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  spawnNodes();
  loop();

  const ro = new ResizeObserver(() => { resize(); spawnNodes(); });
  ro.observe(canvas.parentElement);
}



/* ── Boot button — now just a GitHub link, handled in HTML ── */
function initBootButton() {
  // The "Code" button is now an <a> tag pointing to GitHub — no JS needed.
}

/* ── Module cards with data-prompt attribute ── */
function initModuleCards() {
  document.querySelectorAll(".mod[data-prompt]").forEach(card => {
    card.addEventListener("click", () => {
      const prompt = card.getAttribute("data-prompt");
      if (prompt) {
        console.info("Module prompt:", prompt);
        if (typeof sendPrompt === "function") sendPrompt(prompt);
      }
    });
  });
}

/* ── Smooth-scroll nav links ── */
function initNavLinks() {
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const targetId = link.getAttribute("href").replace("#", "");
      const target = document.getElementById(targetId);
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* ── Animate stat counters on page load ── */
function animateStat(id, target, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(progress * target);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", () => {
  renderTeam();
  initBootButton();
  initNavLinks();
  initModuleCards();
  initHeroCanvas();

  animateStat("sv1", 11, 900);
  animateStat("sv2", 9, 900);
  animateStat("sv3", 13, 900);
});