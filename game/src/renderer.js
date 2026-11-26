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
  grad.addColorStop(0, '#2e6fc4');
  grad.addColorStop(Math.max(0.05, Math.min(0.9, horizon / height)), '#a8d4f0');
  grad.addColorStop(1, '#dceefb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  // Morning sun, fixed in the east.
  const sun = projectPoint(view, view.cam.x + 4000, 1500, view.cam.z - 2600);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
    glow.addColorStop(0, 'rgba(255,244,190,0.95)');
    glow.addColorStop(0.25, 'rgba(255,226,140,0.55)');
    glow.addColorStop(1, 'rgba(255,226,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 140, sun.y - 140, 280, 280);
  }
}

export function drawSea(ctx, width, height, view, time) {
  const corners = [
    [-WORLD_SIZE, -WORLD_SIZE], [WORLD_SIZE, -WORLD_SIZE],
    [WORLD_SIZE, WORLD_SIZE], [-WORLD_SIZE, WORLD_SIZE],
  ].map(([x, z]) => projectPoint(view, x, 0, z));
  if (corners.some((p) => !p)) return;
  ctx.fillStyle = '#1d6fa8';
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
      quads.push({ pa, pb, pc, pd, depth, colour: groundColour(avgH, slope), avgH });
    }
  }
  quads.sort((q1, q2) => q2.depth - q1.depth);
  for (const q of quads) {
    ctx.fillStyle = q.colour;
    ctx.beginPath();
    ctx.moveTo(q.pa.x, q.pa.y); ctx.lineTo(q.pb.x, q.pb.y);
    ctx.lineTo(q.pc.x, q.pc.y); ctx.lineTo(q.pd.x, q.pd.y);
    ctx.closePath(); ctx.fill();
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
  ctx.fillStyle = '#ffd34d';
  for (const z of [RUNWAY.z0 + 12, RUNWAY.z1 - 12]) {
    for (let i = -2; i <= 2; i++) {
      const p = projectPoint(view, RUNWAY.x + i * 6, y + 0.2, z);
      if (p) ctx.fillRect(p.x - 3, p.y - 2, 6, 4);
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
    ctx.fillStyle = `hsl(${b.hue}, 38%, ${52 + (b.height % 7)}%)`;
    ctx.fillRect(p.x - w / 2, p.y, w, h);
    ctx.fillStyle = '#7a3b2e';
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2 - 1, p.y); ctx.lineTo(p.x, p.y - h * 0.22); ctx.lineTo(p.x + w / 2 + 1, p.y);
    ctx.closePath(); ctx.fill();
    // Lit windows: the town looks lived-in from the air.
    ctx.fillStyle = 'rgba(255,236,170,0.9)';
    const cols = Math.max(1, Math.floor(w / 7)), rows = Math.max(1, Math.floor(h / 9));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if ((r * 7 + c * 3 + Math.floor(b.x)) % 3 === 0) ctx.fillRect(p.x - w / 2 + 2 + c * 7, p.y + 3 + r * 9, 3, 4);
    }
    void baseY;
  }
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

export function drawClouds(ctx, view, clouds) {
  const visible = [];
  for (const cloud of clouds) {
    const p = projectPoint(view, cloud.x, cloud.y, cloud.z);
    if (p && p.depth < 4200) visible.push({ cloud, p });
  }
  visible.sort((a, b) => b.p.depth - a.p.depth);
  for (const { cloud, p } of visible) {
    const r = cloud.radius * p.scale;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (let i = 0; i < cloud.puffs; i++) {
      const ox = (i - (cloud.puffs - 1) / 2) * r * 0.55;
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + (i % 2) * r * 0.12, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(210,228,244,0.5)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.16, r * 0.9, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.strokeStyle = done ? 'rgba(120,200,140,0.45)' : active ? '#ffd34d' : 'rgba(140,190,240,0.75)';
    ctx.lineWidth = Math.max(2, radius * 0.09);
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, radius * pulse, radius * 0.82 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = active ? 'rgba(255,211,77,0.35)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, radius * 0.03);
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, radius * 0.8, radius * 0.66, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (active) {
      ctx.fillStyle = '#ffd34d';
      ctx.font = `bold ${Math.max(11, radius * 0.3)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), centre.x, centre.y - radius - 8);
    }
  });
}

export function drawCargoTarget(ctx, view, target, time) {
  const p = projectPoint(view, target.x, target.y + 0.5, target.z);
  if (!p) return;
  const r = target.radius * p.scale;
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
