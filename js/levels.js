'use strict';
/*
 * Level generation for Bus Jam.
 *
 * Levels are generated with "reverse construction": vehicles are driven
 * INTO the board one by one from the borders (opposite to their exit
 * direction). Extracting them in the reverse insertion order is therefore
 * always possible, which guarantees every level is solvable.
 */

const PALETTE = [
  { main: '#ef4444', dark: '#b91c1c', light: '#fca5a5' }, // red
  { main: '#3b82f6', dark: '#1d4ed8', light: '#93c5fd' }, // blue
  { main: '#22c55e', dark: '#15803d', light: '#86efac' }, // green
  { main: '#f4c20d', dark: '#a16207', light: '#fde047' }, // yellow
  { main: '#a855f7', dark: '#7e22ce', light: '#d8b4fe' }, // purple
  { main: '#f97316', dark: '#c2410c', light: '#fdba74' }, // orange
  { main: '#ec4899', dark: '#be185d', light: '#f9a8d4' }, // pink
  { main: '#06b6d4', dark: '#0e7490', light: '#67e8f9' }, // cyan
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function capacityOf(len) {
  return len === 2 ? 4 : 6;
}

function levelConfig(n) {
  return {
    rows: Math.min(7 + Math.floor(n / 5), 11),
    cols: 8,
    colors: Math.min(3 + Math.floor(n / 4), PALETTE.length),
    fill: Math.min(0.60 + n * 0.012, 0.93),
    longProb: Math.min(0.08 + n * 0.01, 0.30),
    // How many consecutive buses get their passengers shuffled together.
    // 1 = strictly ordered queue (easy), 3 = harder.
    mixWindow: n < 4 ? 1 : (n < 12 ? 2 : 3),
    slots: 5,
  };
}

function emptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

// Length of the free run of cells starting at the border of `side` along `lane`.
function freeRun(grid, rows, cols, side, lane) {
  let run = 0;
  if (side === 'top') { for (let y = 0; y < rows; y++) { if (grid[y][lane]) break; run++; } }
  else if (side === 'bottom') { for (let y = rows - 1; y >= 0; y--) { if (grid[y][lane]) break; run++; } }
  else if (side === 'left') { for (let x = 0; x < cols; x++) { if (grid[lane][x]) break; run++; } }
  else { for (let x = cols - 1; x >= 0; x--) { if (grid[lane][x]) break; run++; } }
  return run;
}

// Try to slide a vehicle of length `len` in from a random border.
// Returns {x, y, len, orient, dir} or null.
function tryInsert(grid, rows, cols, rng, len) {
  const side = ['top', 'bottom', 'left', 'right'][Math.floor(rng() * 4)];
  const lanes = (side === 'top' || side === 'bottom') ? cols : rows;
  const lane = Math.floor(rng() * lanes);
  const run = freeRun(grid, rows, cols, side, lane);
  if (run < len) return null;
  // Depth of the vehicle's near end measured from the border. Bias deep to
  // pack the board tightly like the original game.
  const maxD = run - len;
  const d = rng() < 0.7 ? maxD : Math.floor(rng() * (maxD + 1));
  switch (side) {
    case 'top': return { x: lane, y: d, len, orient: 'v', dir: 'up' };
    case 'bottom': return { x: lane, y: rows - d - len, len, orient: 'v', dir: 'down' };
    case 'left': return { x: d, y: lane, len, orient: 'h', dir: 'left' };
    default: return { x: cols - d - len, y: lane, len, orient: 'h', dir: 'right' };
  }
}

function stampVehicle(grid, v, id) {
  for (let i = 0; i < v.len; i++) {
    const x = v.orient === 'h' ? v.x + i : v.x;
    const y = v.orient === 'v' ? v.y + i : v.y;
    grid[y][x] = id;
  }
}

// Generates a level. Returns { cfg, vehicles, queue } where `vehicles` is in
// insertion order (reverse of the guaranteed extraction order) and `queue`
// is the list of passenger color indices.
function generateLevel(n) {
  const cfg = levelConfig(n);
  const rng = mulberry32(n * 7919 + 1013);
  const { rows, cols } = cfg;

  let vehicles = [];
  for (let attempt = 0; attempt < 10 && vehicles.length < 8; attempt++) {
    vehicles = [];
    const grid = emptyGrid(rows, cols);
    const targetCells = Math.floor(rows * cols * cfg.fill);
    let used = 0;
    for (let tries = 0; tries < 900 && used < targetCells; tries++) {
      let len = rng() < cfg.longProb ? 3 : 2;
      let placed = tryInsert(grid, rows, cols, rng, len);
      if (!placed && len === 3) placed = tryInsert(grid, rows, cols, rng, 2);
      if (placed) {
        const id = vehicles.length + 1;
        stampVehicle(grid, placed, id);
        placed.id = id;
        vehicles.push(placed);
        used += placed.len;
      }
    }
  }

  for (const v of vehicles) v.color = Math.floor(rng() * cfg.colors);

  // Passenger queue: blocks of passengers following the guaranteed extraction
  // order (reverse insertion order), locally mixed inside a window so several
  // parked buses can fill in parallel. Stays solvable with >= mixWindow slots.
  const order = vehicles.slice().reverse();
  const queue = [];
  for (let i = 0; i < order.length; i += cfg.mixWindow) {
    const grp = [];
    for (const v of order.slice(i, i + cfg.mixWindow)) {
      for (let k = 0; k < capacityOf(v.len); k++) grp.push(v.color);
    }
    shuffleInPlace(grp, rng);
    queue.push(...grp);
  }

  return { cfg, vehicles, queue };
}

// Re-place the given vehicles (keeping id/color/len) into fresh solvable
// positions. Used by the "refresh" booster. Returns a new array of vehicles
// in insertion order, or null if it could not fit them (practically never
// happens because the board is less full after some buses left).
function reshuffleVehicles(vehicles, rows, cols, rng) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const grid = emptyGrid(rows, cols);
    const list = shuffleInPlace(vehicles.slice(), rng);
    const placed = [];
    let ok = true;
    for (const v of list) {
      let pos = null;
      for (let t = 0; t < 250 && !pos; t++) pos = tryInsert(grid, rows, cols, rng, v.len);
      if (!pos) { ok = false; break; }
      stampVehicle(grid, pos, v.id);
      placed.push({ id: v.id, color: v.color, len: v.len, x: pos.x, y: pos.y, orient: pos.orient, dir: pos.dir });
    }
    if (ok) return placed;
  }
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PALETTE, mulberry32, shuffleInPlace, capacityOf, levelConfig, generateLevel, reshuffleVehicles, emptyGrid, stampVehicle };
}
