// terrain.js — the island of Kestrel Bay: a seeded heightfield with a coast,
// a flattened runway strip, a harbour town and a lighthouse point.

export const WORLD_SIZE = 4200; // metres, square
export const GRID_CELLS = 140;
export const CELL_METRES = WORLD_SIZE / GRID_CELLS;
export const WATER_LEVEL = 0;

// The runway runs north-south on the flat south meadow.
export const RUNWAY = { x: -260, z0: 620, z1: 1180, width: 34, heading: 0 };
// Harbour town sits on the east coast; the lighthouse guards the north point.
export const TOWN_CENTRE = { x: 1180, z: -180 };
export const LIGHTHOUSE = { x: 420, z: -1560 };

function makeSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function smoothNoiseGrid(random, size) {
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = random();
  return grid;
}

function sampleNoise(grid, size, u, v) {
  const x = Math.min(size - 1.001, Math.max(0, u * (size - 1)));
  const z = Math.min(size - 1.001, Math.max(0, v * (size - 1)));
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf), sz = zf * zf * (3 - 2 * zf);
  const a = grid[zi * size + xi], b = grid[zi * size + xi + 1];
  const c = grid[(zi + 1) * size + xi], d = grid[(zi + 1) * size + xi + 1];
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export function buildIslandHeightfield(seed) {
  const random = makeSeededRandom(seed);
  const coarse = smoothNoiseGrid(random, 12);
  const fine = smoothNoiseGrid(random, 36);
  const heights = new Float32Array((GRID_CELLS + 1) * (GRID_CELLS + 1));
  for (let gz = 0; gz <= GRID_CELLS; gz++) {
    for (let gx = 0; gx <= GRID_CELLS; gx++) {
      const x = -WORLD_SIZE / 2 + gx * CELL_METRES;
      const z = -WORLD_SIZE / 2 + gz * CELL_METRES;
      const u = gx / GRID_CELLS, v = gz / GRID_CELLS;
      // Radial falloff makes one island with bays; noise breaks the outline.
      const dx = (x - 120) / 1750, dz = (z + 60) / 1500;
      const coast = 1 - Math.sqrt(dx * dx + dz * dz);
      const hills = sampleNoise(coarse, 12, u, v) * 150 + sampleNoise(fine, 36, u, v) * 42;
      let h = coast * 210 + hills * Math.max(0, coast + 0.25) - 26;
      // A ridge along the west shore gives the ring course its backdrop.
      const ridge = Math.exp(-Math.pow((x + 980) / 420, 2)) * Math.exp(-Math.pow((z + 500) / 900, 2)) * 190;
      h += ridge;
      heights[gz * (GRID_CELLS + 1) + gx] = h;
    }
  }
  flattenRunwayStrip(heights);
  flattenTownShelf(heights);
  return heights;
}

function flattenRunwayStrip(heights) {
  const target = 14;
  for (let gz = 0; gz <= GRID_CELLS; gz++) {
    for (let gx = 0; gx <= GRID_CELLS; gx++) {
      const x = -WORLD_SIZE / 2 + gx * CELL_METRES;
      const z = -WORLD_SIZE / 2 + gz * CELL_METRES;
      const dx = Math.abs(x - RUNWAY.x);
      const dz = Math.max(RUNWAY.z0 - 90 - z, z - (RUNWAY.z1 + 90), 0);
      const dist = Math.sqrt(dx * dx + dz * dz);
      const blend = Math.max(0, 1 - dist / 260);
      const i = gz * (GRID_CELLS + 1) + gx;
      heights[i] = heights[i] * (1 - blend) + target * blend;
    }
  }
}

function flattenTownShelf(heights) {
  const target = 10;
  for (let gz = 0; gz <= GRID_CELLS; gz++) {
    for (let gx = 0; gx <= GRID_CELLS; gx++) {
      const x = -WORLD_SIZE / 2 + gx * CELL_METRES;
      const z = -WORLD_SIZE / 2 + gz * CELL_METRES;
      const dist = Math.hypot(x - TOWN_CENTRE.x, z - TOWN_CENTRE.z);
      const blend = Math.max(0, 1 - dist / 330);
      const i = gz * (GRID_CELLS + 1) + gx;
      heights[i] = heights[i] * (1 - blend * 0.85) + target * blend * 0.85;
    }
  }
}

export function terrainHeightAt(heights, x, z) {
  const gx = (x + WORLD_SIZE / 2) / CELL_METRES;
  const gz = (z + WORLD_SIZE / 2) / CELL_METRES;
  const xi = Math.max(0, Math.min(GRID_CELLS - 1, Math.floor(gx)));
  const zi = Math.max(0, Math.min(GRID_CELLS - 1, Math.floor(gz)));
  const xf = Math.max(0, Math.min(1, gx - xi));
  const zf = Math.max(0, Math.min(1, gz - zi));
  const stride = GRID_CELLS + 1;
  const a = heights[zi * stride + xi], b = heights[zi * stride + xi + 1];
  const c = heights[(zi + 1) * stride + xi], d = heights[(zi + 1) * stride + xi + 1];
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}

// Continuous ground palette: colour flows with height instead of stepping,
// lowland cells take a patchwork field tint, and a light factor from the
// face normal shades every quad so the mesh reads as lit ground, not tiles.
const PALETTE_STOPS = [
  [-6, [196, 178, 128]], // drowned sand under the shallows
  [0.6, [222, 198, 142]], // dry beach at the waterline
  [4, [150, 184, 96]], // shore grass
  [26, [126, 176, 88]], // meadow
  [80, [94, 150, 72]], // pasture
  [160, [72, 122, 62]], // wooded slopes
  [300, [96, 122, 76]], // high pasture
  [420, [232, 238, 242]], // summit snow on the highest ridge
];
const FIELD_TINTS = [
  [138, 188, 92], [112, 168, 80], [168, 192, 96],
  [196, 182, 104], [122, 176, 104], [156, 170, 84],
];

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function groundColour(height, slope, patch = 0, light = 1) {
  let rgb = PALETTE_STOPS[PALETTE_STOPS.length - 1][1];
  for (let i = 1; i < PALETTE_STOPS.length; i++) {
    if (height <= PALETTE_STOPS[i][0]) {
      const [h0, c0] = PALETTE_STOPS[i - 1];
      const [h1, c1] = PALETTE_STOPS[i];
      rgb = mixRgb(c0, c1, (height - h0) / (h1 - h0));
      break;
    }
  }
  // Patchwork fields: neighbouring lowland blocks wear different crops.
  if (height > 3 && height < 95 && slope < 0.5) {
    const field = FIELD_TINTS[Math.floor(patch * FIELD_TINTS.length) % FIELD_TINTS.length];
    rgb = mixRgb(rgb, field, 0.72);
  }
  if (slope > 0.85) rgb = mixRgb(rgb, [138, 127, 114], Math.min(0.8, (slope - 0.85) * 2.4));
  const lit = Math.max(0.62, Math.min(1.18, light));
  return `rgb(${Math.round(rgb[0] * lit)},${Math.round(rgb[1] * lit)},${Math.round(rgb[2] * lit)})`;
}

export function buildTownBuildings(seed) {
  const random = makeSeededRandom(seed ^ 0x9e3779b9);
  const buildings = [];
  // Two street rows along the shore road, then houses scattered behind them.
  for (let i = 0; i < 64; i++) {
    let x, z;
    if (i < 26) {
      const along = (i / 25 - 0.5) * 460;
      x = TOWN_CENTRE.x + along * 0.35 + (random() - 0.5) * 18;
      z = TOWN_CENTRE.z + along + (i % 2 ? 26 : -26) + (random() - 0.5) * 10;
    } else {
      const angle = random() * Math.PI * 2;
      const radius = 40 + random() * 250;
      x = TOWN_CENTRE.x + Math.cos(angle) * radius;
      z = TOWN_CENTRE.z + Math.sin(angle) * radius * 0.8;
    }
    buildings.push({
      x, z,
      width: 15 + random() * 24,
      depth: 13 + random() * 18,
      height: 11 + random() * 36,
      hue: 14 + random() * 34,
      roofHue: 4 + random() * 22,
      gabled: random() > 0.35,
      litSeed: Math.floor(random() * 97),
    });
  }
  return buildings;
}

export function buildCloudField(seed) {
  const random = makeSeededRandom(seed ^ 0x51ab3);
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    const layer = random();
    clouds.push({
      x: (random() - 0.5) * WORLD_SIZE * 1.25,
      y: 330 + layer * 320,
      z: (random() - 0.5) * WORLD_SIZE * 1.25,
      radius: 80 + random() * 190,
      puffs: 4 + Math.floor(random() * 4),
      tone: 0.82 + random() * 0.18, // per-cloud brightness variation
      drift: (random() - 0.5) * 0.4, // puff stagger so no two clouds match
    });
  }
  return clouds;
}
