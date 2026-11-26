// gl-aircraft.js — the Sunwing as real 3D geometry: a swept V flying wing
// with a central pod, tinted canopy, canted fins, deflecting elevons,
// throttle exhaust glow and nav lights; plus the mission rings, cargo
// crate and drop beacon as world geometry.

const HULL = [0.82, 0.8, 0.76];
const HULL_SHADE = [0.55, 0.52, 0.52];
const ACCENT = [0.72, 0.2, 0.16];
const CANOPY = [0.12, 0.22, 0.34];

class PartBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = [];
    this.emissive = [];
    this.indices = [];
  }

  vertex(x, y, z, n, color, emissive = 0) {
    this.positions.push(x, y, z);
    this.normals.push(n[0], n[1], n[2]);
    this.colors.push(color[0], color[1], color[2]);
    this.uvs.push(0, 0);
    this.emissive.push(emissive);
    return this.positions.length / 3 - 1;
  }

  tri(a, b, c) { this.indices.push(a, b, c); }
  quad(a, b, c, d) { this.indices.push(a, b, c, a, c, d); }

  // A thin prism between two parallel quads (top/bottom) — wing panels,
  // fins and elevons are all variations of this.
  panel(top, thickness, colorTop, colorBottom) {
    const bottom = top.map(([x, y, z]) => [x, y - thickness, z]);
    const up = [0, 1, 0], down = [0, -1, 0];
    const t = top.map(([x, y, z]) => this.vertex(x, y, z, up, colorTop));
    const btm = bottom.map(([x, y, z]) => this.vertex(x, y, z, down, colorBottom));
    this.quad(t[0], t[1], t[2], t[3]);
    this.quad(btm[1], btm[0], btm[3], btm[2]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const edge = edgeNormal(top[i], top[j]);
      const e0 = this.vertex(...top[i], edge, colorBottom);
      const e1 = this.vertex(...top[j], edge, colorBottom);
      const e2 = this.vertex(...bottom[j], edge, colorBottom);
      const e3 = this.vertex(...bottom[i], edge, colorBottom);
      this.quad(e0, e1, e2, e3);
    }
  }

  // An 8-sided tapered pod along z: nose at zFront, tail at zBack.
  pod(zFront, zBack, radiusFront, radiusBack, y, color) {
    const sides = 8;
    const ring = (z, r) => {
      const ids = [];
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const nx = Math.cos(a), ny = Math.sin(a);
        ids.push(this.vertex(nx * r * 0.82, y + ny * r * 0.62, z, [nx, ny, 0], color));
      }
      return ids;
    };
    const front = ring(zFront, radiusFront);
    const back = ring(zBack, radiusBack);
    const nose = this.vertex(0, y, zFront - radiusFront * 1.7, [0, 0, -1], color);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.quad(front[i], front[j], back[j], back[i]);
      this.tri(nose, front[j], front[i]);
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

function edgeNormal(a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const len = Math.hypot(dx, dz) || 1;
  return [dz / len, 0, -dx / len];
}

// Static airframe: two swept panels meeting at the pod form the V; the
// trailing edge notches at the centre where the twin exhausts sit.
export function buildAircraftGeometry() {
  const b = new PartBuilder();
  for (const side of [-1, 1]) {
    // Wing panel: root leading edge at the pod, tip swept well back.
    b.panel([
      [side * 0.7, 0.16, -2.6],
      [side * 7.6, 0.34, 1.9],
      [side * 7.6, 0.3, 3.1],
      [side * 0.9, 0.12, 2.2],
    ], 0.22, HULL, HULL_SHADE);
    // Accent tip cap so the V reads at a glance in the chase view.
    b.panel([
      [side * 6.7, 0.36, 1.45],
      [side * 7.6, 0.36, 1.9],
      [side * 7.6, 0.33, 3.1],
      [side * 6.7, 0.33, 2.85],
    ], 0.1, ACCENT, ACCENT);
    // Canted fin near each tip, leaning outward like a V-tail pair.
    b.panel([
      [side * 5.6, 0.3, 1.5],
      [side * 6.3, 1.5, 2.5],
      [side * 6.5, 1.5, 3.2],
      [side * 5.9, 0.3, 2.9],
    ], 0.12, ACCENT, ACCENT);
    // Intake bump on each wing root.
    b.podAt(side * 1.7, 0.28, -0.6, 1.9, 0.42, HULL_SHADE);
  }
  b.pod(-3.4, 2.6, 0.85, 0.62, 0.1, HULL);
  // Canopy: a tinted teardrop over the pod's forward half.
  b.pod(-2.5, 0.4, 0.5, 0.34, 0.52, CANOPY);
  // Twin exhaust rings at the notch, emissive with throttle in the shader
  // via the renderer's per-draw emissive scale on a separate small mesh.
  return b.build();
}

PartBuilder.prototype.podAt = function podAt(cx, cy, zFront, zBack, radius, color) {
  const sides = 6;
  const ring = (z) => {
    const ids = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      ids.push(this.vertex(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius * 0.6, z,
        [Math.cos(a), Math.sin(a), 0], color));
    }
    return ids;
  };
  const front = ring(zFront), back = ring(zBack);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    this.quad(front[i], front[j], back[j], back[i]);
  }
};

// One elevon per side, hinged at its leading edge; the renderer rotates it
// with pitch/roll so control deflections show in the chase view.
export function buildElevonGeometry(side) {
  const b = new PartBuilder();
  b.panel([
    [side * 2.2, 0, 0],
    [side * 6.6, 0.06, 0.55],
    [side * 6.6, 0.04, 1.35],
    [side * 2.2, 0, 0.8],
  ], 0.1, HULL_SHADE, HULL_SHADE);
  return b.build();
}

export function buildExhaustGeometry() {
  const b = new PartBuilder();
  for (const side of [-1, 1]) {
    const glow = [1, 0.55, 0.18];
    const c = b.vertex(side * 0.42, 0.1, 2.62, [0, 0, 1], glow, 2.2);
    const rim = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      rim.push(b.vertex(side * 0.42 + Math.cos(a) * 0.3, 0.1 + Math.sin(a) * 0.22, 2.6, [0, 0, 1], glow, 1.4));
    }
    for (let i = 0; i < 8; i++) b.tri(c, rim[i], rim[(i + 1) % 8]);
  }
  return b.build();
}

export function buildNavLightPoints() {
  return {
    positions: new Float32Array([
      -7.6, 0.3, 2.5, // port red
      7.6, 0.3, 2.5, // starboard green
      0, 0.35, 2.7, // tail white
    ]),
    colors: new Float32Array([1, 0.15, 0.12, 0.2, 1, 0.35, 1, 1, 1]),
    sizes: new Float32Array([3.2, 3.2, 2.6]),
  };
}

// A torus for the mission rings, built once and instanced by model matrix.
export function buildRingGeometry(radius) {
  const b = new PartBuilder();
  const tube = 1.5, ringSegs = 36, tubeSegs = 8;
  const color = [1, 0.78, 0.25];
  const ids = [];
  for (let i = 0; i <= ringSegs; i++) {
    const a = (i / ringSegs) * Math.PI * 2;
    const cx = Math.cos(a) * radius, cy = Math.sin(a) * radius;
    const row = [];
    for (let j = 0; j <= tubeSegs; j++) {
      const t = (j / tubeSegs) * Math.PI * 2;
      const nx = Math.cos(a) * Math.cos(t), ny = Math.sin(a) * Math.cos(t), nz = Math.sin(t);
      row.push(b.vertex(cx + nx * tube, cy + ny * tube, nz * tube, [nx, ny, nz], color, 0.9));
    }
    ids.push(row);
  }
  for (let i = 0; i < ringSegs; i++) {
    for (let j = 0; j < tubeSegs; j++) {
      b.quad(ids[i][j], ids[i + 1][j], ids[i + 1][j + 1], ids[i][j + 1]);
    }
  }
  return b.build();
}

export function buildCrateGeometry() {
  const b = new PartBuilder();
  const wood = [0.62, 0.44, 0.26];
  const s = 1.6;
  const faces = [
    [[-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s], [0, 0, -1]],
    [[s, -s, s], [-s, -s, s], [-s, s, s], [s, s, s], [0, 0, 1]],
    [[-s, -s, s], [-s, -s, -s], [-s, s, -s], [-s, s, s], [-1, 0, 0]],
    [[s, -s, -s], [s, -s, s], [s, s, s], [s, s, -s], [1, 0, 0]],
    [[-s, s, -s], [s, s, -s], [s, s, s], [-s, s, s], [0, 1, 0]],
  ];
  for (const [p0, p1, p2, p3, n] of faces) {
    const ids = [p0, p1, p2, p3].map(([x, y, z]) => b.vertex(x, y, z, n, wood));
    b.quad(ids[0], ids[1], ids[2], ids[3]);
  }
  // Parachute canopy above the crate.
  const canopy = [0.9, 0.45, 0.2];
  const apex = b.vertex(0, 6.4, 0, [0, 1, 0], canopy);
  const rim = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    rim.push(b.vertex(Math.cos(a) * 3.4, 3.4, Math.sin(a) * 3.4, [Math.cos(a), 0.4, Math.sin(a)], canopy));
  }
  for (let i = 0; i < 10; i++) b.tri(apex, rim[(i + 1) % 10], rim[i]);
  return b.build();
}

// A harbour-range training marker: a glowing ground ring with cross
// bars and a striped pylon, readable from a diving attack pass.
export function buildTargetGeometry() {
  const b = new PartBuilder();
  const ringColor = [1, 0.32, 0.18];
  const segs = 28;
  const inner = [], outer = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    inner.push(b.vertex(Math.cos(a) * 19, 0.25, Math.sin(a) * 19, [0, 1, 0], ringColor, 1.5));
    outer.push(b.vertex(Math.cos(a) * 27, 0.25, Math.sin(a) * 27, [0, 1, 0], ringColor, 1.5));
  }
  for (let i = 0; i < segs; i++) b.quad(inner[i], outer[i], outer[i + 1], inner[i + 1]);
  const cross = [1, 0.85, 0.35];
  const strip = (x0, z0, x1, z1) => {
    const ids = [
      b.vertex(x0, 0.35, z0, [0, 1, 0], cross, 1.1),
      b.vertex(x1, 0.35, z0, [0, 1, 0], cross, 1.1),
      b.vertex(x1, 0.35, z1, [0, 1, 0], cross, 1.1),
      b.vertex(x0, 0.35, z1, [0, 1, 0], cross, 1.1),
    ];
    b.quad(ids[0], ids[1], ids[2], ids[3]);
  };
  strip(-24, -2.4, 24, 2.4);
  strip(-2.4, -24, 2.4, 24);
  // Striped pylon: four side faces plus a glowing cap.
  const pylon = [0.92, 0.9, 0.86];
  const faces = [
    [[-2, 0, -2], [2, 0, -2], [2, 16, -2], [-2, 16, -2], [0, 0, -1]],
    [[2, 0, 2], [-2, 0, 2], [-2, 16, 2], [2, 16, 2], [0, 0, 1]],
    [[-2, 0, 2], [-2, 0, -2], [-2, 16, -2], [-2, 16, 2], [-1, 0, 0]],
    [[2, 0, -2], [2, 0, 2], [2, 16, 2], [2, 16, -2], [1, 0, 0]],
  ];
  for (const [p0, p1, p2, p3, n] of faces) {
    const ids = [p0, p1, p2, p3].map(([x, y, z]) => b.vertex(x, y, z, n, pylon));
    b.quad(ids[0], ids[1], ids[2], ids[3]);
  }
  const cap = [
    b.vertex(-2.6, 16, -2.6, [0, 1, 0], ringColor, 1.8),
    b.vertex(2.6, 16, -2.6, [0, 1, 0], ringColor, 1.8),
    b.vertex(2.6, 16, 2.6, [0, 1, 0], ringColor, 1.8),
    b.vertex(-2.6, 16, 2.6, [0, 1, 0], ringColor, 1.8),
  ];
  b.quad(cap[0], cap[1], cap[2], cap[3]);
  return b.build();
}

export function buildBeaconGeometry(radius) {
  const b = new PartBuilder();
  const color = [0.3, 1, 0.55];
  const segs = 28;
  const inner = [], outer = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    inner.push(b.vertex(Math.cos(a) * radius * 0.82, 0, Math.sin(a) * radius * 0.82, [0, 1, 0], color, 1.2));
    outer.push(b.vertex(Math.cos(a) * radius, 0, Math.sin(a) * radius, [0, 1, 0], color, 1.2));
  }
  for (let i = 0; i < segs; i++) b.quad(inner[i], outer[i], outer[i + 1], inner[i + 1]);
  return b.build();
}
