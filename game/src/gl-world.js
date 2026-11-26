// gl-world.js — builds the true-3D Solmere Coast geometry: the terrain
// mesh, merged city buildings with lit-window UVs, the coastal runway,
// harbour cranes and boats, the lighthouse, streetlights and cloud
// billboards. Everything is plain buffers the lit shader can draw.

import {
  WORLD_SIZE, GRID_CELLS, CELL_METRES, RUNWAY, HARBOR, LIGHTHOUSE,
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
      const ids = face.pts.map(([x, y, z], i) => {
        const u = windowScale && !face.roof ? (i === 1 || i === 2 ? face.u / 11 : 0) : 0;
        const v = windowScale && !face.roof ? (i >= 2 ? h / 7 : 0) : 0;
        return this.vertex(x, y, z, face.n[0], face.n[1], face.n[2], color, u, v);
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
  for (let gz = 0; gz < GRID_CELLS; gz++) {
    for (let gx = 0; gx < GRID_CELLS; gx++) {
      const corners = [[gx, gz], [gx + 1, gz], [gx + 1, gz + 1], [gx, gz + 1]];
      const pts = corners.map(([cx, cz]) => {
        const x = -WORLD_SIZE / 2 + cx * CELL_METRES;
        const z = -WORLD_SIZE / 2 + cz * CELL_METRES;
        return [x, heights[cz * stride + cx], z];
      });
      const n = faceNormal(pts[0], pts[1], pts[2]);
      const avgH = (pts[0][1] + pts[2][1]) / 2;
      const slope = 1 - n[1];
      const light = 0.82 + Math.max(0, dot3(n, sunDir)) * 0.35;
      const patch = ((gx * 31 + gz * 57) % 97) / 97;
      const urban = urbanAmount(pts[0][0], pts[0][2]);
      const raw = parseRgb(groundColour(avgH, slope, patch, light, urban));
      const color = raw.map((c) => Math.min(1, c * 1.32 + 0.04));
      const ids = pts.map(([x, y, z]) => b.vertex(x, y, z, n[0], n[1], n[2], color));
      b.quad(ids[0], ids[1], ids[2], ids[3]);
    }
  }
  return b.build();
}

function urbanAmount(x, z) {
  const dx = (x - 90) / 620, dz = (z + 230) / 900;
  const d = Math.sqrt(dx * dx + dz * dz);
  return Math.max(0, 1 - d);
}

export function buildCityGeometry(buildings, heights) {
  const b = new GeometryBuilder();
  for (const building of buildings) {
    const base = terrainHeightAt(heights, building.x, building.z);
    const warm = 0.36 + (building.hue % 17) / 90;
    const color = [warm, warm * 0.82, warm * 1.18];
    b.box(building.x, base + building.height / 2, building.z,
      building.width, building.height, building.depth, color, 1);
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
  // Two portal cranes: legs, beam and a hanging spreader.
  for (const dz of [-70, 40]) {
    const cz = HARBOR.z + dz;
    b.box(HARBOR.x - 60, quayY + 22, cz, 5, 44, 5, [0.85, 0.42, 0.2]);
    b.box(HARBOR.x + 60, quayY + 22, cz, 5, 44, 5, [0.85, 0.42, 0.2]);
    b.box(HARBOR.x, quayY + 46, cz, 150, 5, 6, [0.9, 0.5, 0.24]);
    b.box(HARBOR.x - 30, quayY + 34, cz, 16, 10, 10, [0.3, 0.5, 0.62]);
  }
  // Moored hulls with lit cabins riding the harbour water.
  for (const [dx, dz, len] of [[-150, -40, 90], [-150, 90, 70], [40, 190, 60]]) {
    b.box(HARBOR.x + dx, 2.5, HARBOR.z + dz, 16, 6, len, [0.22, 0.28, 0.4]);
    b.box(HARBOR.x + dx, 8, HARBOR.z + dz - len / 4, 12, 6, 14, [0.9, 0.85, 0.7]);
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
