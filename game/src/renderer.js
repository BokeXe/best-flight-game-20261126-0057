// renderer.js — paints Kestrel Bay: sky, sea, the island mesh, runway, town,
// lighthouse, clouds and the mission rings, all through one projection.

import { projectPoint } from './camera.js';
import {
  WORLD_SIZE, GRID_CELLS, CELL_METRES, RUNWAY, LIGHTHOUSE,
  terrainHeightAt, groundColour,
} from './terrain.js';

export function drawSky(ctx, width, height, view) {
  const horizon = height * 0.52 - view.cam.pitch * height * 0.55;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#2563b8');
  grad.addColorStop(0.34, '#4f93d8');
  grad.addColorStop(Math.max(0.4, Math.min(0.92, horizon / height)), '#b7dcf4');
  grad.addColorStop(1, '#e8f3fb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  // Thin cirrus streaks high above the island.
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  for (let i = 0; i < 7; i++) {
    const cy = height * (0.05 + i * 0.045) + Math.sin(view.cam.heading * 2 + i * 1.7) * 6;
    const cx = ((i * 271) % Math.max(1, width)) + Math.cos(view.cam.heading + i) * 30;
    ctx.beginPath();
    ctx.ellipse(cx, cy, width * (0.16 + (i % 3) * 0.05), 5 + (i % 3) * 2, -0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  // Morning sun, fixed in the east: bright disc inside a wide warm glow.
  const sun = projectPoint(view, view.cam.x + 4000, 1500, view.cam.z - 2600);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 210);
    glow.addColorStop(0, 'rgba(255,250,214,0.98)');
    glow.addColorStop(0.12, 'rgba(255,238,170,0.75)');
    glow.addColorStop(0.45, 'rgba(255,226,140,0.28)');
    glow.addColorStop(1, 'rgba(255,226,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 220, sun.y - 220, 440, 440);
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 17, 0, Math.PI * 2); ctx.fill();
  }
  // Distant haze hugs the horizon so far terrain melts into the sky.
  const hazeTop = Math.max(0, horizon - height * 0.1);
  const haze = ctx.createLinearGradient(0, hazeTop, 0, Math.min(height, horizon + height * 0.16));
  haze.addColorStop(0, 'rgba(226,240,250,0)');
  haze.addColorStop(0.55, 'rgba(226,240,250,0.5)');
  haze.addColorStop(1, 'rgba(226,240,250,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hazeTop, width, Math.min(height, horizon + height * 0.16) - hazeTop);
}

export function drawSea(ctx, width, height, view, time) {
  const corners = [
    [-WORLD_SIZE, -WORLD_SIZE], [WORLD_SIZE, -WORLD_SIZE],
    [WORLD_SIZE, WORLD_SIZE], [-WORLD_SIZE, WORLD_SIZE],
  ].map(([x, z]) => projectPoint(view, x, 0, z));
  if (corners.some((p) => !p)) return;
  // Sea shading: pale turquoise at the horizon deepening toward the viewer.
  const seaGrad = ctx.createLinearGradient(0, height * 0.4, 0, height);
  seaGrad.addColorStop(0, '#5aa7cf');
  seaGrad.addColorStop(0.45, '#2b82b8');
  seaGrad.addColorStop(1, '#155d8f');
  ctx.fillStyle = seaGrad;
  ctx.beginPath();
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  // Sun glitter: short bright dashes scattered on the water.
  ctx.strokeStyle = 'rgba(190,230,255,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const gx = view.cam.x + ((i * 613) % 1600) - 800;
    const gz = view.cam.z + ((i * 389) % 1600) - 800;
    const p = projectPoint(view, gx, 0.4, gz);
    if (!p || p.x < 0 || p.x > width || p.y < 0 || p.y > height) continue;
    const w = 6 + (i % 5) * 3 + Math.sin(time * 2 + i) * 2;
    ctx.beginPath(); ctx.moveTo(p.x - w, p.y); ctx.lineTo(p.x + w, p.y); ctx.stroke();
  }
}

export function drawTerrainMesh(ctx, view, heights, camera) {
  const quads = [];
  const step = 1; // full grid resolution keeps the island's shape readable
  const radius = 1900;
  const minGX = Math.max(0, Math.floor((camera.x - radius + WORLD_SIZE / 2) / CELL_METRES / step));
  const maxGX = Math.min(GRID_CELLS / step - 1, Math.ceil((camera.x + radius + WORLD_SIZE / 2) / CELL_METRES / step));
  const minGZ = Math.max(0, Math.floor((camera.z - radius + WORLD_SIZE / 2) / CELL_METRES / step));
  const maxGZ = Math.min(GRID_CELLS / step - 1, Math.ceil((camera.z + radius + WORLD_SIZE / 2) / CELL_METRES / step));
  const stride = GRID_CELLS + 1;
  const vertex = (gx, gz) => {
    const x = -WORLD_SIZE / 2 + gx * CELL_METRES;
    const z = -WORLD_SIZE / 2 + gz * CELL_METRES;
    return { x, y: heights[gz * stride + gx], z };
  };
  for (let gz = minGZ; gz <= maxGZ; gz++) {
    for (let gx = minGX; gx <= maxGX; gx++) {
      const a = vertex(gx * step, gz * step), b = vertex(gx * step + step, gz * step);
      const c = vertex(gx * step + step, gz * step + step), d = vertex(gx * step, gz * step + step);
      const pa = projectPoint(view, a.x, a.y, a.z), pb = projectPoint(view, b.x, b.y, b.z);
      const pc = projectPoint(view, c.x, c.y, c.z), pd = projectPoint(view, d.x, d.y, d.z);
      if (!pa || !pb || !pc || !pd) continue;
      const depth = (pa.depth + pc.depth) / 2;
      const avgH = (a.y + b.y + c.y + d.y) / 4;
      if (avgH < 0.4 && depth > 500) continue; // the sea plane covers deep water
      const slope = Math.abs(a.y - c.y) / (step * CELL_METRES);
      // Face lighting from the height gradient against a fixed morning sun,
      // a patchwork tint from coarse field blocks, and distance haze: the
      // three together dissolve the grid into lit, varied ground.
      const gradX = (b.y - a.y + c.y - d.y) / (2 * step * CELL_METRES);
      const gradZ = (d.y - a.y + c.y - b.y) / (2 * step * CELL_METRES);
      const light = 1 - gradX * 0.55 + gradZ * 0.3;
      const blockHash = Math.sin(Math.floor(gx / 6) * 127.1 + Math.floor(gz / 6) * 311.7) * 43758.5453;
      const patch = blockHash - Math.floor(blockHash);
      const hazeAmt = Math.max(0, Math.min(0.55, (depth - 900) / 2600));
      quads.push({ pa, pb, pc, pd, depth, colour: groundColour(avgH, slope, patch, light), avgH, hazeAmt });
    }
  }
  quads.sort((q1, q2) => q2.depth - q1.depth);
  for (const q of quads) {
    ctx.fillStyle = q.colour;
    ctx.beginPath();
    ctx.moveTo(q.pa.x, q.pa.y); ctx.lineTo(q.pb.x, q.pb.y);
    ctx.lineTo(q.pc.x, q.pc.y); ctx.lineTo(q.pd.x, q.pd.y);
    ctx.closePath(); ctx.fill();
    // Overdraw a hairline of the same colour to seal anti-aliasing seams.
    ctx.strokeStyle = q.colour;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (q.hazeAmt > 0.02) {
      ctx.fillStyle = `rgba(214,233,247,${q.hazeAmt.toFixed(3)})`;
      ctx.fill();
    }
  }
  drawIslandRoads(ctx, view, heights);
}

// Two roads tie the island together: harbour town to the runway, and a
// shore track from the town up to the lighthouse point.
function drawIslandRoads(ctx, view, heights) {
  const routes = [
    [[1180, -180], [760, 180], [260, 520], [-160, 760], [-260, 900]],
    [[1180, -180], [980, -620], [700, -1040], [420, -1500]],
  ];
  ctx.lineCap = 'round';
  for (const route of routes) {
    for (let i = 0; i < route.length - 1; i++) {
      const [x0, z0] = route[i], [x1, z1] = route[i + 1];
      const steps = 14;
      let prev = null;
      for (let s = 0; s <= steps; s++) {
        const x = x0 + (x1 - x0) * (s / steps);
        const z = z0 + (z1 - z0) * (s / steps);
        const p = projectPoint(view, x, terrainHeightAt(heights, x, z) + 0.5, z);
        if (p && prev) {
          ctx.strokeStyle = 'rgba(112,102,92,0.85)';
          ctx.lineWidth = Math.max(1, p.scale * 5);
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        prev = p;
      }
    }
  }
}

export function drawRunway(ctx, view, heights) {
  const y = terrainHeightAt(heights, RUNWAY.x, (RUNWAY.z0 + RUNWAY.z1) / 2) + 0.4;
  const half = RUNWAY.width / 2;
  const corners = [
    [RUNWAY.x - half, RUNWAY.z0], [RUNWAY.x + half, RUNWAY.z0],
    [RUNWAY.x + half, RUNWAY.z1], [RUNWAY.x - half, RUNWAY.z1],
  ].map(([x, z]) => projectPoint(view, x, y, z));
  if (corners.some((p) => !p)) return;
  ctx.fillStyle = '#3c4450';
  ctx.beginPath();
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath(); ctx.fill();
  // Centreline dashes and threshold bars.
  ctx.strokeStyle = '#f5f7fa';
  ctx.lineWidth = Math.max(1, corners[0].scale * 1.1);
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  const midA = projectPoint(view, RUNWAY.x, y + 0.2, RUNWAY.z0 + 30);
  const midB = projectPoint(view, RUNWAY.x, y + 0.2, RUNWAY.z1 - 30);
  if (midA && midB) { ctx.moveTo(midA.x, midA.y); ctx.lineTo(midB.x, midB.y); ctx.stroke(); }
  ctx.setLineDash([]);
  // White edge stripes frame the strip.
  ctx.strokeStyle = 'rgba(245,247,250,0.9)';
  ctx.lineWidth = Math.max(1, corners[0].scale * 0.8);
  for (const side of [-1, 1]) {
    const e0 = projectPoint(view, RUNWAY.x + side * (half - 1.5), y + 0.2, RUNWAY.z0 + 6);
    const e1 = projectPoint(view, RUNWAY.x + side * (half - 1.5), y + 0.2, RUNWAY.z1 - 6);
    if (e0 && e1) { ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.stroke(); }
  }
  // Threshold piano keys and touchdown bars.
  ctx.fillStyle = '#f5f7fa';
  for (const z of [RUNWAY.z0 + 16, RUNWAY.z1 - 16]) {
    for (let i = -3; i <= 3; i++) {
      const p = projectPoint(view, RUNWAY.x + i * 4.4, y + 0.2, z);
      if (p) ctx.fillRect(p.x - Math.max(1.5, p.scale * 1.4), p.y - 2, Math.max(3, p.scale * 2.8), 4);
    }
  }
  // Edge lights glow along both sides so the strip reads at a glance.
  for (let z = RUNWAY.z0 + 20; z <= RUNWAY.z1 - 20; z += 56) {
    for (const side of [-1, 1]) {
      const p = projectPoint(view, RUNWAY.x + side * (half + 3), y + 0.6, z);
      if (!p) continue;
      const r = Math.max(1.6, p.scale * 1.6);
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      halo.addColorStop(0, 'rgba(255,224,130,0.95)');
      halo.addColorStop(1, 'rgba(255,224,130,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function drawTownAndLighthouse(ctx, view, heights, buildings, time) {
  const drawn = [];
  for (const b of buildings) {
    const baseY = terrainHeightAt(heights, b.x, b.z);
    const p = projectPoint(view, b.x, baseY + b.height, b.z);
    if (!p || p.depth > 2600) continue;
    drawn.push({ b, p, baseY });
  }
  drawn.sort((d1, d2) => d2.p.depth - d1.p.depth);
  for (const { b, p, baseY } of drawn) {
    const w = Math.max(2, b.width * p.scale * 0.55);
    const h = Math.max(2, b.height * p.scale);
    const depthPx = Math.max(1.5, b.depth * p.scale * 0.3);
    const light = 50 + (b.litSeed % 9);
    // Sunlit front wall, shaded side wall: each house reads as a solid box.
    ctx.fillStyle = `hsl(${b.hue}, 36%, ${light}%)`;
    ctx.fillRect(p.x - w / 2, p.y, w, h);
    ctx.fillStyle = `hsl(${b.hue}, 30%, ${light - 13}%)`;
    ctx.beginPath();
    ctx.moveTo(p.x + w / 2, p.y); ctx.lineTo(p.x + w / 2 + depthPx, p.y - depthPx * 0.5);
    ctx.lineTo(p.x + w / 2 + depthPx, p.y + h - depthPx * 0.5); ctx.lineTo(p.x + w / 2, p.y + h);
    ctx.closePath(); ctx.fill();
    // Roof: gabled prism in its own clay tone, or a flat slab.
    ctx.fillStyle = `hsl(${b.roofHue}, 42%, ${34 + (b.litSeed % 6)}%)`;
    ctx.beginPath();
    if (b.gabled) {
      ctx.moveTo(p.x - w / 2 - 1.5, p.y); ctx.lineTo(p.x, p.y - h * 0.24);
      ctx.lineTo(p.x + w / 2 + depthPx + 1, p.y - depthPx * 0.5);
      ctx.lineTo(p.x + depthPx * 0.4, p.y - h * 0.24 - depthPx * 0.5);
    } else {
      ctx.moveTo(p.x - w / 2 - 1, p.y); ctx.lineTo(p.x + w / 2 + depthPx, p.y - depthPx * 0.5);
      ctx.lineTo(p.x + w / 2 + depthPx, p.y - depthPx * 0.5 + 2.5); ctx.lineTo(p.x - w / 2 - 1, p.y + 2.5);
    }
    ctx.closePath(); ctx.fill();
    // Windows in a regular grid, some lit: the town looks lived-in.
    const cols = Math.max(1, Math.floor(w / 7)), rows = Math.max(1, Math.floor(h / 9));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const litWin = (r * 11 + c * 5 + b.litSeed) % 3 !== 0;
      ctx.fillStyle = litWin ? 'rgba(255,238,178,0.95)' : 'rgba(52,72,96,0.75)';
      ctx.fillRect(p.x - w / 2 + 2 + c * 7, p.y + 3 + r * 9, 3, 4);
    }
    void baseY;
  }
  drawHarbourBoats(ctx, view, time);
  // Lighthouse: striped tower with a rotating beam.
  const lhBase = terrainHeightAt(heights, LIGHTHOUSE.x, LIGHTHOUSE.z);
  const top = projectPoint(view, LIGHTHOUSE.x, lhBase + 58, LIGHTHOUSE.z);
  const foot = projectPoint(view, LIGHTHOUSE.x, lhBase, LIGHTHOUSE.z);
  if (top && foot) {
    const w = Math.max(3, top.scale * 7);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#e8eef2' : '#c0392b';
      const y0 = foot.y - (foot.y - top.y) * (i / 5);
      const y1 = foot.y - (foot.y - top.y) * ((i + 1) / 5);
      ctx.fillRect(top.x - w / 2, y1, w, y0 - y1);
    }
    ctx.fillStyle = '#22303f';
    ctx.fillRect(top.x - w * 0.7, top.y - 6, w * 1.4, 7);
    const beamAngle = time * 0.7;
    ctx.fillStyle = 'rgba(255,240,170,0.35)';
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - 3);
    ctx.lineTo(top.x + Math.cos(beamAngle) * 220, top.y - 3 + Math.sin(beamAngle) * 40 - 14);
    ctx.lineTo(top.x + Math.cos(beamAngle) * 220, top.y - 3 + Math.sin(beamAngle) * 40 + 14);
    ctx.closePath(); ctx.fill();
  }
}

// A short pier and three fishing boats make the harbour read as a harbour.
function drawHarbourBoats(ctx, view, time) {
  const pierA = projectPoint(view, 1330, 2, -60);
  const pierB = projectPoint(view, 1420, 2, 30);
  if (pierA && pierB) {
    ctx.strokeStyle = '#6e5a44';
    ctx.lineWidth = Math.max(2, pierA.scale * 6);
    ctx.beginPath(); ctx.moveTo(pierA.x, pierA.y); ctx.lineTo(pierB.x, pierB.y); ctx.stroke();
  }
  const boats = [[1400, 90, '#c0392b'], [1460, -20, '#2471a3'], [1360, 180, '#e8eef2']];
  for (const [bx, bz, hull] of boats) {
    const p = projectPoint(view, bx, 1 + Math.sin(time * 1.3 + bx) * 0.4, bz);
    if (!p || p.depth > 2400) continue;
    const w = Math.max(3, p.scale * 14), h = Math.max(2, p.scale * 4);
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y);
    ctx.lineTo(p.x + w * 0.34, p.y + h); ctx.lineTo(p.x - w * 0.34, p.y + h);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(240,246,250,0.9)';
    ctx.lineWidth = Math.max(1, p.scale * 0.8);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - h * 2.4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h * 2.4); ctx.lineTo(p.x + w * 0.3, p.y - h * 0.3); ctx.lineTo(p.x, p.y - h * 0.3);
    ctx.closePath(); ctx.fill();
  }
}

export function drawClouds(ctx, view, clouds) {
  const visible = [];
  for (const cloud of clouds) {
    const p = projectPoint(view, cloud.x, cloud.y, cloud.z);
    if (p && p.depth < 4200) visible.push({ cloud, p });
  }
  visible.sort((a, b) => b.p.depth - a.p.depth);
  for (const { cloud, p } of visible) {
    const r = cloud.radius * p.scale;
    if (r < 4) continue;
    const haze = Math.max(0, Math.min(0.5, (p.depth - 1600) / 4200));
    // Layered puffs: shaded bellies first, sunlit crowns on top, each puff a
    // soft radial gradient so the cloud has volume instead of a flat rim.
    for (let i = 0; i < cloud.puffs; i++) {
      const ox = (i - (cloud.puffs - 1) / 2) * r * 0.5;
      const oy = Math.sin(i * 2.1 + cloud.drift * 6) * r * 0.09;
      const pr = r * (0.5 + (i % 3) * 0.09);
      const belly = ctx.createRadialGradient(p.x + ox, p.y + oy + pr * 0.25, 1, p.x + ox, p.y + oy + pr * 0.25, pr);
      belly.addColorStop(0, `rgba(198,216,234,${0.5 * cloud.tone})`);
      belly.addColorStop(1, 'rgba(198,216,234,0)');
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(p.x + ox, p.y + oy + pr * 0.22, pr, pr * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      const crown = ctx.createRadialGradient(p.x + ox - pr * 0.2, p.y + oy - pr * 0.2, 1, p.x + ox, p.y + oy, pr);
      crown.addColorStop(0, `rgba(255,255,255,${0.95 * cloud.tone})`);
      crown.addColorStop(0.65, `rgba(248,251,254,${0.8 * cloud.tone})`);
      crown.addColorStop(1, 'rgba(248,251,254,0)');
      ctx.fillStyle = crown;
      ctx.beginPath(); ctx.ellipse(p.x + ox, p.y + oy, pr, pr * 0.52, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (haze > 0.03) {
      ctx.fillStyle = `rgba(216,234,248,${haze.toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.15, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function drawMissionRings(ctx, view, rings, activeIndex, time) {
  rings.forEach((ring, i) => {
    const centre = projectPoint(view, ring.x, ring.y, ring.z);
    if (!centre) return;
    const active = i === activeIndex;
    const done = i < activeIndex;
    const radius = ring.radius * centre.scale;
    if (radius < 3) return;
    const pulse = active ? 1 + Math.sin(time * 4) * 0.06 : 1;
    // Halo first, then the ring itself: the active target glows at any size.
    if (active) {
      const halo = ctx.createRadialGradient(centre.x, centre.y, radius * 0.4, centre.x, centre.y, radius * 1.5);
      halo.addColorStop(0, 'rgba(255,211,77,0.22)');
      halo.addColorStop(1, 'rgba(255,211,77,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.ellipse(centre.x, centre.y, radius * 1.5, radius * 1.24, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = done ? 'rgba(120,200,140,0.45)' : active ? '#ffd34d' : 'rgba(140,190,240,0.75)';
    ctx.lineWidth = Math.max(2.5, radius * 0.1);
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, radius * pulse, radius * 0.82 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = active ? 'rgba(255,243,196,0.9)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = Math.max(1, radius * 0.035);
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, radius * 0.82, radius * 0.67, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (active) {
      // Four chevrons point into the gate so the goal reads when shrunk.
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = Math.max(2, radius * 0.07);
      ctx.lineCap = 'round';
      const chev = radius * 0.2;
      for (const [cx, cy, dx, dy] of [[0, -1.25, 0, 1], [0, 1.25, 0, -1], [-1.25, 0, 1, 0], [1.25, 0, -1, 0]]) {
        const px = centre.x + cx * radius, py = centre.y + cy * radius * 0.82;
        ctx.beginPath();
        ctx.moveTo(px - dy * chev, py - dx * chev);
        ctx.lineTo(px + dx * chev * 0.6, py + dy * chev * 0.6);
        ctx.lineTo(px + dy * chev, py + dx * chev);
        ctx.stroke();
      }
      // Number badge with a dark rim stays legible on bright sky.
      const badgeR = Math.max(10, radius * 0.24);
      const by = centre.y - radius * 0.82 - badgeR - 6;
      ctx.fillStyle = 'rgba(13,26,42,0.88)';
      ctx.beginPath(); ctx.arc(centre.x, by, badgeR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.font = `bold ${Math.max(11, badgeR * 1.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), centre.x, by + 1);
      ctx.textBaseline = 'alphabetic';
    }
  });
}

export function drawCargoTarget(ctx, view, target, time) {
  const p = projectPoint(view, target.x, target.y + 0.5, target.z);
  if (!p) return;
  const r = target.radius * p.scale;
  // A translucent beacon column marks the zone from far away.
  const top = projectPoint(view, target.x, target.y + 130, target.z);
  if (top) {
    const beam = ctx.createLinearGradient(0, top.y, 0, p.y);
    beam.addColorStop(0, 'rgba(255,90,77,0)');
    beam.addColorStop(1, 'rgba(255,90,77,0.28)');
    ctx.fillStyle = beam;
    ctx.fillRect(p.x - r * 0.32, top.y, r * 0.64, p.y - top.y);
  }
  ctx.strokeStyle = '#ff5a4d';
  ctx.lineWidth = Math.max(2, r * 0.08);
  for (const f of [1, 0.62, 0.3]) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * f, r * f * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff5a4d';
  ctx.font = `bold ${Math.max(11, Math.min(30, r * 0.24))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('DROP ZONE', p.x, p.y - r * 0.55 - Math.sin(time * 3) * 2);
}

// The aircraft's shadow on the ground below sells its height at a glance.
export function drawAircraftShadow(ctx, view, aircraft, heights) {
  const groundY = Math.max(0, terrainHeightAt(heights, aircraft.x, aircraft.z));
  const p = projectPoint(view, aircraft.x, groundY + 0.4, aircraft.z);
  if (!p) return;
  const heightAbove = Math.max(0, aircraft.y - groundY);
  const spread = Math.max(6, (26 + heightAbove * 0.12) * p.scale);
  const alpha = Math.max(0.06, Math.min(0.34, 0.36 - heightAbove * 0.0009));
  ctx.fillStyle = `rgba(18,30,44,${alpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, spread, spread * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawFallingCrate(ctx, view, crate) {
  if (!crate) return;
  const p = projectPoint(view, crate.x, crate.y, crate.z);
  if (!p) return;
  const s = Math.max(3, 2.2 * p.scale);
  ctx.fillStyle = '#b07a3f';
  ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  ctx.strokeStyle = '#6e4a22';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
  ctx.beginPath();
  ctx.moveTo(p.x - s / 2, p.y - s / 2); ctx.lineTo(p.x + s / 2, p.y + s / 2);
  ctx.moveTo(p.x + s / 2, p.y - s / 2); ctx.lineTo(p.x - s / 2, p.y + s / 2);
  ctx.stroke();
  // Parachute canopy above the crate.
  ctx.fillStyle = '#e2574c';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - s * 1.1, s * 0.95, s * 0.4, 0, Math.PI, 0);
  ctx.fill();
}
