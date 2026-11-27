// gl-world.js — builds the true-3D Solmere Coast geometry: the terrain
// mesh, merged city buildings with lit-window UVs, the coastal runway,
// harbour cranes and boats, the lighthouse, streetlights and cloud
// billboards. Everything is plain buffers the lit shader can draw.

import {
  WORLD_SIZE, GRID_CELLS, CELL_METRES, RUNWAY, HARBOR, LIGHTHOUSE,
  AVENUES, CROSS_STREETS, STADIUM,
  groundColour, terrainHeightAt,
} from './terrain.js';

export function parseRgb(text) {
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(text);
  return m ? [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255] : [0.5, 0.5, 0.5];
}

class GeometryBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = [];
    this.emissive = [];
    this.indices = [];
  }

  vertex(x, y, z, nx, ny, nz, color, u = 0, v = 0, emissive = 0) {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.colors.push(color[0], color[1], color[2]);
    this.uvs.push(u, v);
    this.emissive.push(emissive);
    return this.positions.length / 3 - 1;
  }

  quad(a, b, c, d) {
    this.indices.push(a, b, c, a, c, d);
  }

  // An axis-aligned box with per-face shading baked into the normals; the
  // window UVs scale with the face size so lit windows stay storey-sized.
  box(cx, cy, cz, w, h, d, color, windowScale = 0) {
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    const faces = [
      { n: [0, 0, -1], pts: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], u: w },
      { n: [0, 0, 1], pts: [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], u: w },
      { n: [-1, 0, 0], pts: [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], u: d },
      { n: [1, 0, 0], pts: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], u: d },
      { n: [0, 1, 0], pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], u: w, roof: true },
    ];
    for (const face of faces) {
      // Roofs catch the last sun: lift them toward warm grey so a tower
      // top reads as a roof, not as another dark facade. Window UVs use
      // wide repeats, so each lit window is a real storey-sized pane.
      const faceColor = face.roof
        ? [Math.min(1, color[0] * 1.35 + 0.16), Math.min(1, color[1] * 1.3 + 0.13), Math.min(1, color[2] * 1.2 + 0.1)]
        : color;
      const ids = face.pts.map(([x, y, z], i) => {
        const u = windowScale && !face.roof ? (i === 1 || i === 2 ? face.u / 21 : 0) : 0;
        const v = windowScale && !face.roof ? (i >= 2 ? h / 14 : 0) : 0;
        return this.vertex(x, y, z, face.n[0], face.n[1], face.n[2], faceColor, u, v);
      });
      this.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }

  cylinder(cx, cy, cz, radius, height, color, segments = 10, emissive = 0) {
    const y0 = cy - height / 2, y1 = cy + height / 2;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const nx = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2);
      const p = (a, y) => [cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius];
      const v0 = this.vertex(...p(a0, y0), nx, 0, nz, color, 0, 0, emissive);
      const v1 = this.vertex(...p(a1, y0), nx, 0, nz, color, 0, 0, emissive);
      const v2 = this.vertex(...p(a1, y1), nx, 0, nz, color, 0, 0, emissive);
      const v3 = this.vertex(...p(a0, y1), nx, 0, nz, color, 0, 0, emissive);
      this.quad(v0, v1, v2, v3);
    }
  }

  build() {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: new Float32Array(this.colors),
      uvs: new Float32Array(this.uvs),
      emissive: new Float32Array(this.emissive),
      indices: new Uint32Array(this.indices),
    };
  }
}

export function buildTerrainGeometry(heights) {
  const b = new GeometryBuilder();
  const stride = GRID_CELLS + 1;
  const sunDir = normalize3([-0.92, 0.18, -0.35]);
  // Shared vertices on the 30 m heightfield grid (19,881 verts):
  // a quarter of the duplicated-corner vertex work, with the runway
  // flattening and shoreline kept at full resolution.
  const step = 1;
  const rowVerts = GRID_CELLS / step + 1;
  for (let gz = 0; gz <= GRID_CELLS; gz += step) {
    for (let gx = 0; gx <= GRID_CELLS; gx += step) {
      const x = -WORLD_SIZE / 2 + gx * CELL_METRES;
      const z = -WORLD_SIZE / 2 + gz * CELL_METRES;
      const h = heights[gz * stride + gx];
      const hL = heights[gz * stride + Math.max(0, gx - 1)];
      const hR = heights[gz * stride + Math.min(GRID_CELLS, gx + 1)];
      const hD = heights[Math.max(0, gz - 1) * stride + gx];
      const hU = heights[Math.min(GRID_CELLS, gz + 1) * stride + gx];
      const n = normalize3([-(hR - hL) / (2 * CELL_METRES), 1, -(hU - hD) / (2 * CELL_METRES)]);
      const slope = 1 - n[1];
      const light = 0.82 + Math.max(0, dot3(n, sunDir)) * 0.35;
      const patch = ((gx * 31 + gz * 57) % 97) / 97;
      const raw = parseRgb(groundColour(h, slope, patch, light, urbanAmount(x, z)));
      const color = raw.map((c) => Math.min(1, c * 1.32 + 0.04));
      b.vertex(x, h, z, n[0], n[1], n[2], color);
    }
  }
  for (let gz = 0; gz < GRID_CELLS; gz += step) {
    for (let gx = 0; gx < GRID_CELLS; gx += step) {
      const a = (gz / step) * rowVerts + gx / step;
      b.quad(a, a + 1, a + rowVerts + 1, a + rowVerts);
    }
  }
  return b.build();
}

function urbanAmount(x, z) {
  const dx = (x - 90) / 620, dz = (z + 230) / 900;
  const d = Math.sqrt(dx * dx + dz * dz);
  return Math.max(0, 1 - d);
}

// Three facade families — warm sand, slate and terracotta — so the
// skyline has variety a pilot can navigate by, not one repeated tint.
const FACADE_FAMILIES = [
  [0.62, 0.5, 0.4],
  [0.42, 0.47, 0.58],
  [0.6, 0.42, 0.36],
];

export function buildCityGeometry(buildings, heights) {
  const b = new GeometryBuilder();
  for (const building of buildings) {
    const base = terrainHeightAt(heights, building.x, building.z);
    const family = FACADE_FAMILIES[Math.floor(Math.abs(building.hue)) % FACADE_FAMILIES.length];
    const lift = 0.85 + ((building.hue * 7) % 13) / 40;
    const color = family.map((c) => Math.min(1, c * lift));
    b.box(building.x, base + building.height / 2, building.z,
      building.width, building.height, building.depth, color, 1);
    // Rooftop clutter — water tanks, lift houses, vent stacks — so a
    // low pass over the roofs reads as a lived-in city, not bare boxes.
    const roofSeed = Math.abs(Math.floor(building.litSeed || building.hue * 31));
    if (building.height > 24) {
      const tankX = building.x + ((roofSeed % 7) - 3) * 2.2;
      const tankZ = building.z + ((roofSeed % 5) - 2) * 2.6;
      b.cylinder(tankX, base + building.height + 3.4, tankZ, 3.2, 6.8, [0.5, 0.4, 0.34], 8);
      b.box(building.x - building.width * 0.22, base + building.height + 2,
        building.z + building.depth * 0.2, 7, 4, 6, [0.4, 0.38, 0.44]);
    }
    if (building.tower) {
      b.box(building.x + building.width * 0.24, base + building.height + 1.6,
        building.z - building.depth * 0.18, 5, 3.2, 5, [0.55, 0.52, 0.5]);
      b.box(building.x, base + building.height + 5.5, building.z, 0.8, 9, 0.8, [0.7, 0.68, 0.66]);
    }
    if (building.landmark) {
      // A lit crown and beacon so the landmarks anchor every skyline view.
      b.box(building.x, base + building.height + 3, building.z,
        building.width * 0.5, 6, building.depth * 0.5, [1, 0.72, 0.3], 0);
      const beacon = b.vertex(building.x, base + building.height + 8, building.z, 0, 1, 0, [1, 0.25, 0.2], 0, 0, 2);
      b.indices.push(beacon, beacon, beacon);
    }
  }
  return b.build();
}

export function buildRunwayGeometry() {
  const b = new GeometryBuilder();
  const y = 12.35;
  const x0 = RUNWAY.x - RUNWAY.width / 2, x1 = RUNWAY.x + RUNWAY.width / 2;
  const dark = [0.16, 0.16, 0.2];
  const ids = [
    b.vertex(x0, y, RUNWAY.z0, 0, 1, 0, dark),
    b.vertex(x1, y, RUNWAY.z0, 0, 1, 0, dark),
    b.vertex(x1, y, RUNWAY.z1, 0, 1, 0, dark),
    b.vertex(x0, y, RUNWAY.z1, 0, 1, 0, dark),
  ];
  b.quad(ids[0], ids[1], ids[2], ids[3]);
  const paint = [0.92, 0.9, 0.84];
  // Threshold piano keys, centreline dashes and edge lines as thin quads.
  for (let i = 0; i < 6; i++) {
    const kx = x0 + 3 + i * 5.4;
    stripe(b, kx, y + 0.04, RUNWAY.z0 + 12, 2.4, 26, paint);
    stripe(b, kx, y + 0.04, RUNWAY.z1 - 12, 2.4, 26, paint);
  }
  for (let z = RUNWAY.z0 + 60; z < RUNWAY.z1 - 50; z += 46) {
    stripe(b, RUNWAY.x - 1.1, y + 0.04, z, 2.2, 24, paint);
  }
  stripe(b, x0 + 1, y + 0.04, RUNWAY.z0, 1.4, RUNWAY.z1 - RUNWAY.z0, paint);
  stripe(b, x1 - 2.4, y + 0.04, RUNWAY.z0, 1.4, RUNWAY.z1 - RUNWAY.z0, paint);
  // Touchdown zone bars the landing mission aims at.
  stripe(b, RUNWAY.x - 11, y + 0.05, RUNWAY.z0 + 178, 22, 3.4, [1, 0.72, 0.25]);
  stripe(b, RUNWAY.x - 11, y + 0.05, RUNWAY.z0 + 202, 22, 3.4, [1, 0.72, 0.25]);
  // Approach light gantries south of the threshold.
  for (let i = 1; i <= 6; i++) {
    const z = RUNWAY.z0 - i * 42;
    b.box(RUNWAY.x, 13.4, z, 9, 0.5, 0.5, [1, 0.95, 0.8], 0);
  }
  return b.build();
}

function stripe(b, x, y, z, w, d, color) {
  const ids = [
    b.vertex(x, y, z, 0, 1, 0, color),
    b.vertex(x + w, y, z, 0, 1, 0, color),
    b.vertex(x + w, y, z + d, 0, 1, 0, color),
    b.vertex(x, y, z + d, 0, 1, 0, color),
  ];
  b.quad(ids[0], ids[1], ids[2], ids[3]);
}

export function buildHarborGeometry(heights) {
  const b = new GeometryBuilder();
  const quayY = 3.2;
  b.box(HARBOR.x, quayY, HARBOR.z, 240, 3, 300, [0.42, 0.38, 0.36]);
  // Three portal cranes: legs, beam, trolley and a hanging spreader,
  // the third one slewed toward the container yard for variety.
  for (const dz of [-110, -10, 90]) {
    const cz = HARBOR.z + dz;
    b.box(HARBOR.x - 60, quayY + 22, cz, 5, 44, 5, [0.85, 0.42, 0.2]);
    b.box(HARBOR.x + 60, quayY + 22, cz, 5, 44, 5, [0.85, 0.42, 0.2]);
    b.box(HARBOR.x, quayY + 46, cz, 150, 5, 6, [0.9, 0.5, 0.24]);
    b.box(HARBOR.x - 30, quayY + 34, cz, 16, 10, 10, [0.3, 0.5, 0.62]);
    b.box(HARBOR.x - 30, quayY + 44, cz, 8, 4, 8, [0.95, 0.8, 0.4]);
  }
  // Container yard: stacked boxes in shipping colours, two and three
  // high, so the quay reads as a working port from the air.
  const boxColors = [
    [0.72, 0.28, 0.2], [0.2, 0.42, 0.66], [0.24, 0.56, 0.34],
    [0.85, 0.55, 0.18], [0.5, 0.3, 0.55], [0.75, 0.72, 0.68],
  ];
  let seed = 4242;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      if (rand() < 0.18) continue;
      const cx = HARBOR.x + 30 + row * 22;
      const cz = HARBOR.z - 120 + col * 34;
      const stack = 1 + Math.floor(rand() * 3);
      for (let s = 0; s < stack; s++) {
        b.box(cx, quayY + 3 + s * 5.4, cz, 18, 5.2, 30, boxColors[Math.floor(rand() * boxColors.length)]);
      }
    }
  }
  // Moored hulls with lit cabins riding the harbour water.
  for (const [dx, dz, len] of [[-150, -40, 90], [-150, 90, 70], [40, 190, 60]]) {
    b.box(HARBOR.x + dx, 2.5, HARBOR.z + dz, 16, 6, len, [0.22, 0.28, 0.4]);
    b.box(HARBOR.x + dx, 8, HARBOR.z + dz - len / 4, 12, 6, 14, [0.9, 0.85, 0.7]);
  }
  // Marina south of the quay: finger piers with moored sailboats,
  // masts catching the last light.
  for (let pier = 0; pier < 3; pier++) {
    const pz = HARBOR.z + 210 + pier * 46;
    b.box(HARBOR.x - 70, 2.2, pz, 110, 1.6, 6, [0.45, 0.36, 0.28]);
    for (let boat = 0; boat < 5; boat++) {
      const bx = HARBOR.x - 112 + boat * 22;
      const bz = pz + (boat % 2 ? 8 : -8);
      b.box(bx, 1.6, bz, 4.4, 1.8, 11, [0.88, 0.86, 0.8]);
      b.box(bx, 8.5, bz, 0.5, 13, 0.5, [0.8, 0.78, 0.72]);
      b.box(bx, 7.5, bz + 1.6, 0.3, 9, 3.4, [0.95, 0.9, 0.8]);
    }
  }
  // Lighthouse on the north headland: striped tower, gallery, lamp room.
  const lhBase = terrainHeightAt(heights, LIGHTHOUSE.x, LIGHTHOUSE.z);
  b.cylinder(LIGHTHOUSE.x, lhBase + 9, LIGHTHOUSE.z, 7, 18, [0.85, 0.3, 0.24], 12);
  b.cylinder(LIGHTHOUSE.x, lhBase + 26, LIGHTHOUSE.z, 6, 16, [0.92, 0.9, 0.86], 12);
  b.cylinder(LIGHTHOUSE.x, lhBase + 40, LIGHTHOUSE.z, 5, 12, [0.85, 0.3, 0.24], 12);
  b.cylinder(LIGHTHOUSE.x, lhBase + 49, LIGHTHOUSE.z, 4.4, 6, [1, 0.85, 0.45], 10, 1.6);
  b.cylinder(LIGHTHOUSE.x, lhBase + 55, LIGHTHOUSE.z, 5.2, 2.4, [0.2, 0.2, 0.26], 10);
  return b.build();
}

// Street grid: dark asphalt ribbons following the city shelf, with pale
// centre dashes. Avenues and cross streets overlap at intersections, so
// the grid reads as one network from the air.
export function buildStreetsGeometry(heights) {
  const b = new GeometryBuilder();
  const asphalt = [0.13, 0.13, 0.17];
  const dash = [0.85, 0.78, 0.55];
  const seg = 60;
  for (const avenueX of AVENUES) {
    for (let z = -1040; z < 680; z += seg) {
      const y0 = terrainHeightAt(heights, avenueX, z) + 0.35;
      const y1 = terrainHeightAt(heights, avenueX, z + seg) + 0.35;
      const ids = [
        b.vertex(avenueX - 11, y0, z, 0, 1, 0, asphalt),
        b.vertex(avenueX + 11, y0, z, 0, 1, 0, asphalt),
        b.vertex(avenueX + 11, y1, z + seg, 0, 1, 0, asphalt),
        b.vertex(avenueX - 11, y1, z + seg, 0, 1, 0, asphalt),
      ];
      b.quad(ids[0], ids[1], ids[2], ids[3]);
      if ((z / seg) % 2 === 0) stripe(b, avenueX - 0.7, y0 + 0.06, z + 8, 1.4, 16, dash);
    }
  }
  for (const streetZ of CROSS_STREETS) {
    for (let x = -320; x < 540; x += seg) {
      const y0 = terrainHeightAt(heights, x, streetZ) + 0.32;
      const y1 = terrainHeightAt(heights, x + seg, streetZ) + 0.32;
      const ids = [
        b.vertex(x, y0, streetZ - 9, 0, 1, 0, asphalt),
        b.vertex(x + seg, y1, streetZ - 9, 0, 1, 0, asphalt),
        b.vertex(x + seg, y1, streetZ + 9, 0, 1, 0, asphalt),
        b.vertex(x, y0, streetZ + 9, 0, 1, 0, asphalt),
      ];
      b.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }
  return b.build();
}

// Landmarks that make the open world navigable: the stadium ring with
// floodlights east of downtown, and a suspension bridge across the bay
// to the lighthouse headland.
export function buildLandmarksGeometry(heights) {
  const b = new GeometryBuilder();
  const base = terrainHeightAt(heights, STADIUM.x, STADIUM.z);
  // Stadium: an elliptical ring wall, a lit inner bowl and four
  // floodlight masts whose lamps glow against the dusk.
  const segs = 28;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const p = (a, r, y) => [STADIUM.x + Math.cos(a) * r * 1.25, y, STADIUM.z + Math.sin(a) * r];
    const wall = [0.5, 0.46, 0.52];
    const ids = [
      b.vertex(...p(a0, 86, base), Math.cos(a0), 0, Math.sin(a0), wall),
      b.vertex(...p(a1, 86, base), Math.cos(a1), 0, Math.sin(a1), wall),
      b.vertex(...p(a1, 86, base + 26), Math.cos(a1), 0, Math.sin(a1), wall),
      b.vertex(...p(a0, 86, base + 26), Math.cos(a0), 0, Math.sin(a0), wall),
    ];
    b.quad(ids[0], ids[1], ids[2], ids[3]);
    const rim = [
      b.vertex(...p(a0, 86, base + 26), 0, 1, 0, [0.9, 0.8, 0.55], 0, 0, 0.7),
      b.vertex(...p(a1, 86, base + 26), 0, 1, 0, [0.9, 0.8, 0.55], 0, 0, 0.7),
      b.vertex(...p(a1, 62, base + 14), 0, 1, 0, [0.35, 0.55, 0.3]),
      b.vertex(...p(a0, 62, base + 14), 0, 1, 0, [0.35, 0.55, 0.3]),
    ];
    b.quad(rim[0], rim[1], rim[2], rim[3]);
  }
  for (const a of [0.6, 2.2, 3.8, 5.4]) {
    const mx = STADIUM.x + Math.cos(a) * 100, mz = STADIUM.z + Math.sin(a) * 82;
    b.box(mx, base + 22, mz, 3, 44, 3, [0.3, 0.3, 0.36]);
    b.box(mx, base + 46, mz, 12, 4, 3, [1, 0.95, 0.8], 0);
  }
  // Bay bridge: deck, two pylons and cable stays crossing the water
  // toward the lighthouse headland, traffic-ready at dusk.
  const bz = -1180, deckY = 34;
  b.box(-470, deckY, bz, 460, 3, 16, [0.32, 0.32, 0.4]);
  for (const px of [-560, -380]) {
    b.box(px, deckY + 26, bz, 6, 58, 18, [0.85, 0.45, 0.25]);
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      b.box(px + i * 26, deckY + 26 - Math.abs(i) * 5, bz, 1.6, 30 - Math.abs(i) * 3, 1.6, [0.9, 0.85, 0.75]);
    }
  }
  for (let x = -690; x <= -250; x += 44) {
    b.box(x, deckY + 3.4, bz - 7, 2, 2, 2, [1, 0.8, 0.4], 0);
    b.box(x, deckY + 3.4, bz + 7, 2, 2, 2, [1, 0.8, 0.4], 0);
  }
  // Ferris wheel on the waterfront promenade: a lit rim of cabins
  // turning the skyline into a postcard from the sunset side.
  const wheelX = -215, wheelZ = -340;
  const wheelBase = terrainHeightAt(heights, wheelX, wheelZ);
  const wheelY = wheelBase + 42;
  b.box(wheelX - 10, wheelBase + 20, wheelZ, 3, 42, 3, [0.4, 0.38, 0.5]);
  b.box(wheelX + 10, wheelBase + 20, wheelZ, 3, 42, 3, [0.4, 0.38, 0.5]);
  const cabins = 14;
  for (let i = 0; i < cabins; i++) {
    const a = (i / cabins) * Math.PI * 2;
    const cx = wheelX + Math.cos(a) * 34;
    const cy = wheelY + Math.sin(a) * 34;
    b.box(cx, cy, wheelZ, 5, 5, 5, i % 2 ? [1, 0.62, 0.3] : [0.45, 0.75, 0.95]);
    b.box(wheelX + Math.cos(a) * 17, wheelY + Math.sin(a) * 17, wheelZ, 1.4, 1.4, 1.4, [0.85, 0.82, 0.75]);
  }
  b.cylinder(wheelX, wheelY, wheelZ, 3.4, 3, [1, 0.85, 0.45], 10, 1.2);
  // Water tower over the suburbs: a tank on legs every pilot can spot.
  const towerX = 700, towerZ = 300;
  const towerBase = terrainHeightAt(heights, towerX, towerZ);
  for (const [lx, lz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
    b.box(towerX + lx, towerBase + 14, towerZ + lz, 2.4, 28, 2.4, [0.42, 0.36, 0.34]);
  }
  b.cylinder(towerX, towerBase + 35, towerZ, 13, 14, [0.62, 0.5, 0.42], 12);
  b.cylinder(towerX, towerBase + 44, towerZ, 13.6, 3, [0.5, 0.3, 0.24], 12);
  // Clock tower downtown: a slim shaft with a lit clock face and spire.
  const clockX = 95, clockZ = -180;
  const clockBase = terrainHeightAt(heights, clockX, clockZ);
  b.box(clockX, clockBase + 34, clockZ, 14, 68, 14, [0.58, 0.48, 0.4], 1);
  b.box(clockX, clockBase + 72, clockZ, 17, 9, 17, [1, 0.88, 0.6]);
  b.cylinder(clockX, clockBase + 82, clockZ, 3, 12, [0.3, 0.3, 0.42], 8);
  b.box(clockX, clockBase + 90, clockZ, 2, 2, 2, [1, 0.3, 0.22]);
  return b.build();
}

// One bay boat: hull, cabin and a lit masthead. Cargo boats get a
// container block; sailboats a white sail triangle of boxes.
export function buildBoatGeometry(boat) {
  const b = new GeometryBuilder();
  if (boat.cargo) {
    b.box(0, 2.2, 0, 13, 5, 62, boat.color);
    b.box(0, 6.4, 20, 10, 5, 12, [0.9, 0.86, 0.74]);
    b.box(0, 5.6, -8, 11, 3.4, 16, [0.72, 0.3, 0.22]);
    b.box(0, 5.6, -24, 11, 3.4, 14, [0.22, 0.42, 0.62]);
    b.box(0, 10.5, 20, 1, 4, 1, [1, 0.9, 0.6]);
  } else {
    b.box(0, 1.2, 0, 4.6, 2, 13, [0.9, 0.88, 0.82]);
    b.box(0, 8, 0, 0.5, 13, 0.5, [0.8, 0.78, 0.72]);
    b.box(0, 7.2, 2.1, 0.3, 9.5, 4.2, [0.96, 0.92, 0.84]);
    b.box(0, 14.8, 0, 1.1, 1.1, 1.1, [1, 0.85, 0.45]);
  }
  return b.build();
}

// One traffic car: body, cabin, glowing headlights and taillights.
// Built facing -z like the aircraft, drawn per car by model matrix.
export function buildCarGeometry(color) {
  const b = new GeometryBuilder();
  b.box(0, 0.75, 0, 2.1, 0.9, 4.6, color);
  b.box(0, 1.45, 0.25, 1.8, 0.7, 2.3, [0.16, 0.2, 0.3]);
  b.box(-0.65, 0.8, -2.32, 0.5, 0.3, 0.08, [1, 0.95, 0.8], 0);
  b.box(0.65, 0.8, -2.32, 0.5, 0.3, 0.08, [1, 0.95, 0.8], 0);
  b.box(-0.65, 0.8, 2.32, 0.5, 0.3, 0.08, [1, 0.2, 0.15], 0);
  b.box(0.65, 0.8, 2.32, 0.5, 0.3, 0.08, [1, 0.2, 0.15], 0);
  return b.build();
}

export function buildStreetlightPoints(buildings, heights) {
  const positions = [];
  const colors = [];
  const sizes = [];
  for (const avenueX of [-190, -70, 55, 180, 305, 430]) {
    for (let z = -1030; z <= 670; z += 64) {
      const y = terrainHeightAt(heights, avenueX, z) + 7;
      positions.push(avenueX + 14, y, z);
      colors.push(1, 0.72, 0.34);
      sizes.push(2.6);
    }
  }
  for (let z = RUNWAY.z0; z <= RUNWAY.z1; z += 56) {
    positions.push(RUNWAY.x - 21, 13.4, z, RUNWAY.x + 21, 13.4, z);
    colors.push(1, 0.85, 0.4, 1, 0.85, 0.4);
    sizes.push(2.2, 2.2);
  }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    sizes: new Float32Array(sizes),
  };
}

export function buildCloudBillboards(clouds) {
  const positions = [];
  const corners = [];
  const sizes = [];
  const alphas = [];
  for (const cloud of clouds) {
    for (let i = 0; i < cloud.puffs; i++) {
      const spread = (i - (cloud.puffs - 1) / 2) * cloud.radius * 0.55;
      const x = cloud.x + spread + cloud.drift * i * 9;
      const y = cloud.y + Math.sin(i * 1.7 + cloud.drift * 8) * 14;
      const z = cloud.z + Math.cos(i * 2.3) * 20;
      const size = cloud.radius * (0.55 + (i % 3) * 0.14);
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
        positions.push(x, y, z);
        corners.push(cx, cy);
        sizes.push(size);
        alphas.push(0.5 * cloud.tone);
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    corners: new Float32Array(corners),
    sizes: new Float32Array(sizes),
    alphas: new Float32Array(alphas),
  };
}

function faceNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return normalize3([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
