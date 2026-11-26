// terrain.js — Solmere Coast at golden hour: a seeded coastal heightfield
// with the sea to the west, a beach and harbour, a lit city shelf along the
// shore, a coastal runway, and dusk hills inland.

export const WORLD_SIZE = 4200; // metres, square
export const GRID_CELLS = 140;
export const CELL_METRES = WORLD_SIZE / GRID_CELLS;
export const WATER_LEVEL = 0;

// The coastal runway runs north-south just inland from the beach.
export const RUNWAY = { x: 260, z0: 620, z1: 1180, width: 36, heading: 0 };
// Solmere's skyline hugs the shore; the harbour and lighthouse sit west/north.
export const CITY_CENTRE = { x: 90, z: -230 };
export const HARBOR = { x: -290, z: 150 };
export const LIGHTHOUSE = { x: -360, z: -1510 };
// Low sun over the western sea: the light every dusk colour is mixed against.
export const SUNSET = { x: -4200, y: 210, z: -1850 };

// Open-world street grid: avenues run north-south parallel to the shore,
// cross streets step down the coast. Traffic, streetlights and the canyon
// mission all key off these two lists so the city stays coherent.
export const AVENUES = [-190, -70, 55, 180, 305, 430];
export const CROSS_STREETS = [-900, -700, -500, -300, -100, 100, 300, 500];

// Named districts give the free-roam city its geography: the minimap
// labels them, the courier chain drops in them, and free flight announces
// the district under the wing.
export const STADIUM = { x: 520, z: -520 };
export const DISTRICTS = [
  { name: 'DOWNTOWN', x: 150, z: -300, r: 340 },
  { name: 'WATERFRONT', x: -160, z: -80, r: 300 },
  { name: 'HARBOR', x: -290, z: 150, r: 260 },
  { name: 'BEACHFRONT', x: -260, z: 620, r: 300 },
  { name: 'STADIUM', x: STADIUM.x, z: STADIUM.z, r: 250 },
  { name: 'SUBURBS', x: 780, z: 420, r: 460 },
  { name: 'AIRFIELD', x: 260, z: 900, r: 320 },
];

export function districtAt(x, z) {
  let best = null, bestScore = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(x - d.x, z - d.z) / d.r;
    if (dist < bestScore) { bestScore = dist; best = d; }
  }
  return bestScore <= 1.6 ? best.name : 'SOLMERE COAST';
}

// Dusk traffic: simple cars driving the avenues and cross streets. Each
// car is a pure function of mission time (offset + speed * t, wrapped),
// so the city moves identically in live play and in screenshot scenes.
export function buildTraffic(seed) {
  const random = makeSeededRandom(seed ^ 0x7a11c);
  const palette = [
    [0.85, 0.3, 0.22], [0.25, 0.45, 0.8], [0.9, 0.85, 0.75], [0.3, 0.7, 0.4],
    [0.95, 0.65, 0.2], [0.55, 0.4, 0.75], [0.8, 0.8, 0.85], [0.2, 0.25, 0.35],
  ];
  const cars = [];
  for (const avenueX of AVENUES) {
    for (let i = 0; i < 7; i++) {
      const dir = random() < 0.5 ? 1 : -1;
      cars.push({
        axis: 'z', road: avenueX, lane: dir > 0 ? 5.5 : -5.5, dir,
        speed: 8 + random() * 6, offset: -1020 + random() * 1700,
        color: palette[Math.floor(random() * palette.length)],
      });
    }
  }
  for (const streetZ of CROSS_STREETS) {
    for (let i = 0; i < 4; i++) {
      const dir = random() < 0.5 ? 1 : -1;
      cars.push({
        axis: 'x', road: streetZ, lane: dir > 0 ? -5 : 5, dir,
        speed: 7 + random() * 5, offset: -320 + random() * 860,
        color: palette[Math.floor(random() * palette.length)],
      });
    }
  }
  return cars;
}

export function trafficPose(car, time, heights) {
  // Returns world position + heading for one car at a mission time.
  if (car.axis === 'z') {
    const span = 1700;
    const z = -1020 + ((car.offset + car.dir * car.speed * time) % span + span) % span;
    const x = car.road + car.lane;
    return { x, y: terrainHeightAt(heights, x, z) + 0.9, z, heading: car.dir > 0 ? Math.PI : 0 };
  }
  const span = 860;
  const x = -320 + ((car.offset + car.dir * car.speed * time) % span + span) % span;
  const z = car.road + car.lane;
  return { x, y: terrainHeightAt(heights, x, z) + 0.9, z, heading: car.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

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

export function shorelineX(z) {
  // A curved west-facing shore: bays and headlands instead of a straight cut.
  return -455 + Math.sin(z / 620) * 255 + Math.sin(z / 255 + 1.3) * 118;
}

export function buildCoastalHeightfield(seed) {
  const random = makeSeededRandom(seed);
  const coarse = smoothNoiseGrid(random, 12);
  const fine = smoothNoiseGrid(random, 36);
  const heights = new Float32Array((GRID_CELLS + 1) * (GRID_CELLS + 1));
  for (let gz = 0; gz <= GRID_CELLS; gz++) {
    for (let gx = 0; gx <= GRID_CELLS; gx++) {
      const x = -WORLD_SIZE / 2 + gx * CELL_METRES;
      const z = -WORLD_SIZE / 2 + gz * CELL_METRES;
      const u = gx / GRID_CELLS, v = gz / GRID_CELLS;
      const inland = x - shorelineX(z); // metres east of the waterline
      const noise = sampleNoise(coarse, 12, u, v) * 0.72 + sampleNoise(fine, 36, u, v) * 0.28;
      let h;
      if (inland < 0) {
        // Sea floor shelves away westward; shallows stay visible near shore.
        h = -3 + inland * 0.035 - noise * 4;
      } else {
        // Beach, then a gentle city shelf, then dusk hills rising inland.
        const beach = 1.2 + Math.min(5, inland * 0.035);
        const shelf = 8 + Math.min(16, Math.max(0, inland - 180) * 0.018);
        const hills = Math.pow(Math.max(0, inland - 620) / 1450, 1.35) * (150 + noise * 190);
        const eastRidge = Math.exp(-Math.pow((x - 1420) / 520, 2)) * Math.exp(-Math.pow((z - 260) / 1050, 2)) * 150;
        const northHeadland = Math.exp(-Math.pow((x + 260) / 360, 2)) * Math.exp(-Math.pow((z + 1520) / 420, 2)) * 54;
        h = Math.max(beach, shelf) + hills + eastRidge + northHeadland + noise * Math.min(18, inland * 0.02);
      }
      heights[gz * (GRID_CELLS + 1) + gx] = h;
    }
  }
  flattenRunwayStrip(heights);
  flattenCityShelf(heights);
  return heights;
}

function flattenRunwayStrip(heights) {
  const target = 12;
  for (let gz = 0; gz <= GRID_CELLS; gz++) {
    for (let gx = 0; gx <= GRID_CELLS; gx++) {
      const x = -WORLD_SIZE / 2 + gx * CELL_METRES;
      const z = -WORLD_SIZE / 2 + gz * CELL_METRES;
      const dx = Math.abs(x - RUNWAY.x);
      const dz = Math.max(RUNWAY.z0 - 110 - z, z - (RUNWAY.z1 + 110), 0);
      const dist = Math.sqrt(dx * dx + dz * dz);
      const blend = Math.max(0, 1 - dist / 300);
      const i = gz * (GRID_CELLS + 1) + gx;
      heights[i] = heights[i] * (1 - blend) + target * blend;
    }
  }
}

function flattenCityShelf(heights) {
  // One broad, nearly level shelf carries the skyline, avenues and harbour
  // apron; the beach west of it keeps its natural fall to the water.
  for (let gz = 0; gz <= GRID_CELLS; gz++) {
    for (let gx = 0; gx <= GRID_CELLS; gx++) {
      const x = -WORLD_SIZE / 2 + gx * CELL_METRES;
      const z = -WORLD_SIZE / 2 + gz * CELL_METRES;
      const dx = (x - CITY_CENTRE.x) / 620;
      const dz = (z - CITY_CENTRE.z) / 900;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const blend = Math.max(0, 1 - dist) * 0.92;
      const target = 9 + Math.max(0, x - shorelineX(z)) * 0.004;
      const i = gz * (GRID_CELLS + 1) + gx;
      heights[i] = heights[i] * (1 - blend) + target * blend;
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

// Continuous dusk palette: warm sand at the waterline, olive shore ground,
// mauve-shadowed hills inland, and warm city pavement on the urban shelf.
// A light factor from the face normal shades every quad toward the low sun.
const PALETTE_STOPS = [
  [-6, [176, 132, 96]], // drowned sand under the shallows
  [0.6, [238, 190, 126]], // sunlit dry beach at the waterline
  [4, [190, 150, 92]], // beach grass and promenade verge
  [18, [146, 128, 76]], // dry shore ground
  [70, [112, 108, 66]], // olive lowland
  [160, [82, 88, 62]], // wooded dusk slopes
  [300, [96, 82, 78]], // mauve high ground
  [460, [150, 118, 104]], // last light on the highest ridge
];
const FIELD_TINTS = [
  [150, 132, 78], [124, 120, 70], [168, 138, 84],
  [138, 116, 72], [116, 112, 76], [158, 126, 80],
];
const CITY_TINTS = [
  [104, 96, 96], [92, 88, 94], [116, 102, 92],
  [86, 84, 92], [110, 98, 88], [98, 94, 100],
];

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function groundColour(height, slope, patch = 0, light = 1, urban = 0) {
  let rgb = PALETTE_STOPS[PALETTE_STOPS.length - 1][1];
  for (let i = 1; i < PALETTE_STOPS.length; i++) {
    if (height <= PALETTE_STOPS[i][0]) {
      const [h0, c0] = PALETTE_STOPS[i - 1];
      const [h1, c1] = PALETTE_STOPS[i];
      rgb = mixRgb(c0, c1, (height - h0) / (h1 - h0));
      break;
    }
  }
  // Dry lowland blocks vary like parched plots; the city shelf instead takes
  // warm pavement tones so streets and blocks sit on urban ground.
  if (height > 3 && height < 95 && slope < 0.5) {
    const field = FIELD_TINTS[Math.floor(patch * FIELD_TINTS.length) % FIELD_TINTS.length];
    rgb = mixRgb(rgb, field, 0.55);
  }
  if (urban > 0.02 && height > 2) {
    const city = CITY_TINTS[Math.floor(patch * CITY_TINTS.length) % CITY_TINTS.length];
    rgb = mixRgb(rgb, city, Math.min(0.92, urban));
  }
  if (slope > 0.85) rgb = mixRgb(rgb, [126, 96, 88], Math.min(0.8, (slope - 0.85) * 2.4));
  const lit = Math.max(0.6, Math.min(1.24, light));
  return `rgb(${Math.round(rgb[0] * lit)},${Math.round(rgb[1] * lit)},${Math.round(rgb[2] * lit)})`;
}

export function buildCityBuildings(seed) {
  const random = makeSeededRandom(seed ^ 0x9e3779b9);
  const buildings = [];
  const avenues = [-190, -70, 55, 180, 305, 430];
  // Avenues run parallel to the shore; cross streets step down the coast.
  // Height peaks in the downtown cluster and along the waterfront hotels,
  // then falls away to low residential blocks inland and to the south.
  for (const avenueX of avenues) {
    for (let z = -1040; z <= 680; z += 92) {
      if (random() < 0.16) continue; // a park, plaza or side street gap
      const x = avenueX + (random() - 0.5) * 22;
      const zz = z + (random() - 0.5) * 20;
      const downtown = Math.exp(-Math.pow((x - 150) / 250, 2)) * Math.exp(-Math.pow((zz + 300) / 330, 2));
      const waterfront = Math.exp(-Math.pow((x + 150) / 150, 2)) * Math.exp(-Math.pow((zz + 120) / 520, 2));
      const height = 16 + random() * 22 + downtown * (62 + random() * 78) + waterfront * (24 + random() * 42);
      buildings.push({
        x, z: zz,
        width: 24 + random() * 30,
        depth: 20 + random() * 24,
        height,
        hue: 18 + random() * 30,
        roofHue: 220 + random() * 24,
        tower: height > 72,
        litSeed: Math.floor(random() * 997),
      });
      // A second, smaller block behind many lots layers the skyline so the
      // city reads deep instead of one row of boxes along each avenue.
      if (random() < 0.55) {
        const backHeight = height * (0.4 + random() * 0.45) + 6;
        buildings.push({
          x: x + 34 + random() * 14, z: zz + (random() - 0.5) * 30,
          width: 17 + random() * 18,
          depth: 15 + random() * 16,
          height: backHeight,
          hue: 14 + random() * 34,
          roofHue: 216 + random() * 28,
          tower: backHeight > 76,
          litSeed: Math.floor(random() * 997),
        });
      }
    }
  }
  // Suburban blocks east and south: low houses on the rising ground so
  // the open world keeps reading as a city beyond the downtown shelf.
  for (let gx = 560; gx <= 1060; gx += 96) {
    for (let gz = -160; gz <= 780; gz += 96) {
      if (random() < 0.3) continue;
      if (Math.hypot(gx - STADIUM.x, gz - STADIUM.z) < 190) continue;
      const height = 6 + random() * 8;
      buildings.push({
        x: gx + (random() - 0.5) * 26, z: gz + (random() - 0.5) * 26,
        width: 16 + random() * 14, depth: 14 + random() * 12,
        height, hue: 20 + random() * 26, roofHue: 215 + random() * 30,
        tower: false, litSeed: Math.floor(random() * 997),
      });
    }
  }
  // Landmark towers anchor the skyline in every screenshot: the central
  // spire plus two lit-crown towers north and south along the waterfront.
  buildings.push({
    x: 150, z: -330, width: 46, depth: 40, height: 168,
    hue: 26, roofHue: 228, tower: true, landmark: true, litSeed: 731,
  });
  buildings.push({
    x: -120, z: -560, width: 38, depth: 34, height: 128,
    hue: 22, roofHue: 224, tower: true, landmark: true, litSeed: 412,
  });
  buildings.push({
    x: 215, z: 60, width: 40, depth: 36, height: 118,
    hue: 30, roofHue: 232, tower: true, landmark: true, litSeed: 905,
  });
  return buildings;
}

export function buildCloudField(seed) {
  const random = makeSeededRandom(seed ^ 0x51ab3);
  const clouds = [];
  for (let i = 0; i < 42; i++) {
    const layer = random();
    clouds.push({
      x: (random() - 0.5) * WORLD_SIZE * 1.25,
      y: 340 + layer * 300,
      z: (random() - 0.5) * WORLD_SIZE * 1.25,
      radius: 85 + random() * 185,
      puffs: 4 + Math.floor(random() * 4),
      tone: 0.82 + random() * 0.18, // per-cloud brightness variation
      drift: (random() - 0.5) * 0.4, // puff stagger so no two clouds match
    });
  }
  return clouds;
}
