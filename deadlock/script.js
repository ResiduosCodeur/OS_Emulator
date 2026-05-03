function parseList(value) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function parseEdges(value) {
  if (!value.trim()) return [];

  return value.trim().split(/\s+/).map(edge => {
    const parts = edge.split("-");
    return {
      from: parts[0],
      to: parts[1]
    };
  }).filter(edge => edge.from && edge.to);
}

function addLog(message, type = "info") {
  const log = document.getElementById("log");
  const time = new Date().toLocaleTimeString("en-US", { hour12: false });

  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span>[${time}]</span><p class="${type}">${message}</p>`;

  log.prepend(entry);
}

function buildGraph(requestEdges, allocationEdges) {
  const graph = {};

  [...requestEdges, ...allocationEdges].forEach(edge => {
    if (!graph[edge.from]) graph[edge.from] = [];
    graph[edge.from].push(edge.to);

    if (!graph[edge.to]) graph[edge.to] = [];
  });

  return graph;
}

function detectCycle(graph) {
  const visited = {};
  const stack = {};
  const parent = {};
  let cycle = [];

  function dfs(node) {
    visited[node] = true;
    stack[node] = true;

    for (const neighbour of graph[node]) {
      if (!visited[neighbour]) {
        parent[neighbour] = node;

        if (dfs(neighbour)) return true;
      } else if (stack[neighbour]) {
        cycle.push(neighbour);

        let current = node;
        while (current !== neighbour) {
          cycle.push(current);
          current = parent[current];
        }

        cycle.push(neighbour);
        cycle.reverse();
        return true;
      }
    }

    stack[node] = false;
    return false;
  }

  for (const node in graph) {
    if (!visited[node]) {
      if (dfs(node)) return cycle;
    }
  }

  return null;
}

function drawGraph(processes, resources, requestEdges, allocationEdges, cyclePath = []) {
  const svg = document.getElementById("graph");
  svg.innerHTML = `
    <defs>
      <marker id="arrow-request" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#e8c83c"></path>
      </marker>

      <marker id="arrow-allocation" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#38bea0"></path>
      </marker>

      <marker id="arrow-cycle" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#e85078"></path>
      </marker>
    </defs>
  `;

  const positions = {};

  processes.forEach((p, index) => {
    positions[p] = {
      x: 180,
      y: 90 + index * 90
    };
  });

  resources.forEach((r, index) => {
    positions[r] = {
      x: 650,
      y: 110 + index * 120
    };
  });

  const cycleEdges = new Set();
  for (let i = 0; i < cyclePath.length - 1; i++) {
    cycleEdges.add(`${cyclePath[i]}-${cyclePath[i + 1]}`);
  }

  function drawEdge(edge, type) {
    const from = positions[edge.from];
    const to = positions[edge.to];

    if (!from || !to) return;

    const key = `${edge.from}-${edge.to}`;
    const isCycle = cycleEdges.has(key);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.setAttribute("class", isCycle ? "edge cycle-edge" : `edge ${type}-edge`);
    line.setAttribute("marker-end", isCycle ? "url(#arrow-cycle)" : `url(#arrow-${type})`);

    svg.appendChild(line);
  }

  requestEdges.forEach(edge => drawEdge(edge, "request"));
  allocationEdges.forEach(edge => drawEdge(edge, "allocation"));

  processes.forEach(p => {
    const pos = positions[p];

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", pos.x);
    circle.setAttribute("cy", pos.y);
    circle.setAttribute("r", 30);
    circle.setAttribute("class", cyclePath.includes(p) ? "node process-node cycle-node" : "node process-node");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", pos.x);
    text.setAttribute("y", pos.y + 5);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "node-text");
    text.textContent = p;

    svg.appendChild(circle);
    svg.appendChild(text);
  });

  resources.forEach(r => {
    const pos = positions[r];

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", pos.x - 32);
    rect.setAttribute("y", pos.y - 28);
    rect.setAttribute("width", 64);
    rect.setAttribute("height", 56);
    rect.setAttribute("rx", 10);
    rect.setAttribute("class", cyclePath.includes(r) ? "node resource-node cycle-node" : "node resource-node");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", pos.x);
    text.setAttribute("y", pos.y + 5);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "node-text");
    text.textContent = r;

    svg.appendChild(rect);
    svg.appendChild(text);
  });
}

function runSimulation() {
  const processes = parseList(document.getElementById("processes").value);
  const resources = parseList(document.getElementById("resources").value);
  const requestEdges = parseEdges(document.getElementById("requests").value);
  const allocationEdges = parseEdges(document.getElementById("allocations").value);

  const graph = buildGraph(requestEdges, allocationEdges);
  const cycle = detectCycle(graph);

  const status = document.getElementById("status");
  const cyclePath = document.getElementById("cyclePath");

  if (cycle) {
    status.textContent = "Deadlock Detected";
    status.className = "status danger";
    cyclePath.textContent = cycle.join(" → ");
    addLog("Deadlock detected due to cycle: " + cycle.join(" → "), "error");
  } else {
    status.textContent = "No Deadlock";
    status.className = "status safe";
    cyclePath.textContent = "None";
    addLog("No cycle found. System is deadlock-free.", "success");
  }

  drawGraph(processes, resources, requestEdges, allocationEdges, cycle || []);
}

function loadDeadlockExample() {
  document.getElementById("processes").value = "P1 P2";
  document.getElementById("resources").value = "R1 R2";
  document.getElementById("requests").value = "P1-R1 P2-R2";
  document.getElementById("allocations").value = "R1-P2 R2-P1";
  addLog("Loaded deadlock example", "info");
  runSimulation();
}

function loadSafeExample() {
  document.getElementById("processes").value = "P1 P2 P3";
  document.getElementById("resources").value = "R1 R2";
  document.getElementById("requests").value = "P1-R1 P3-R2";
  document.getElementById("allocations").value = "R1-P2";
  addLog("Loaded safe example", "info");
  runSimulation();
}

function clearAll() {
  document.getElementById("processes").value = "";
  document.getElementById("resources").value = "";
  document.getElementById("requests").value = "";
  document.getElementById("allocations").value = "";
  document.getElementById("status").textContent = "Waiting for simulation";
  document.getElementById("status").className = "status neutral";
  document.getElementById("cyclePath").textContent = "None";
  document.getElementById("graph").innerHTML = "";
  addLog("Cleared all inputs", "warning");
}

document.addEventListener("DOMContentLoaded", () => {
  addLog("Deadlock Detection Simulator initialized", "info");
  runSimulation();
});