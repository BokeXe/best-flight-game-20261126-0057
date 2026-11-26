// renderer.js — paints Solmere Coast at sunset: dusk sky, glittering sea,
// the coastal mesh, lit skyline, harbour, runway and mission rings, all
// through one projection.

import { projectPoint } from './camera.js';
import {
  WORLD_SIZE, GRID_CELLS, CELL_METRES, RUNWAY, LIGHTHOUSE, HARBOR, SUNSET,
  CITY_CENTRE, shorelineX, terrainHeightAt, groundColour,
} from './terrain.js';

export function drawSky(ctx, width, height, view) {
  const horizon = height * 0.52 - view.cam.pitch * height * 0.55;
  const horizonStop = Math.max(0.42, Math.min(0.94, horizon / height));
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#1c2c58'); // dusk blue overhead
  grad.addColorStop(0.3, '#4b3568'); // violet band
  grad.addColorStop(Math.max(0.36, horizonStop - 0.16), '#b6506e'); // rose
  grad.addColorStop(horizonStop, '#ff8a3d'); // deep orange at the waterline
  grad.addColorStop(Math.min(1, horizonStop + 0.08), '#ffd27a'); // gold seam
  grad.addColorStop(1, '#7a4a52');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  // High cirrus catches the last light in pink streaks.
  ctx.fillStyle = 'rgba(255,178,150,0.20)';
  for (let i = 0; i < 7; i++) {
    const cy = height * (0.05 + i * 0.045) + Math.sin(view.cam.heading * 2 + i * 1.7) * 6;
    const cx = ((i * 271) % Math.max(1, width)) + Math.cos(view.cam.heading + i) * 30;
    ctx.beginPath();
    ctx.ellipse(cx, cy, width * (0.16 + (i % 3) * 0.05), 5 + (i % 3) * 2, -0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  // First stars prick the dusk blue overhead, above the violet band.
  ctx.fillStyle = 'rgba(235,242,255,0.75)';
  for (let i = 0; i < 46; i++) {
    const sx = ((i * 389) % Math.max(1, width)) + Math.sin(view.cam.heading * 3 + i) * 4;
    const sy = height * (0.02 + ((i * 71) % 20) / 100);
    const tw = 0.5 + ((i * 37) % 10) / 14;
    ctx.globalAlpha = tw * 0.8;
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  // Low sun over the western sea: a large disc inside layered warm glow,
  // with a horizontal lens-warmth streak through it.
  const sun = projectPoint(view, view.cam.x + SUNSET.x, view.cam.y + SUNSET.y, view.cam.z + SUNSET.z);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 6, sun.x, sun.y, 380);
    glow.addColorStop(0, 'rgba(255,244,190,0.98)');
    glow.addColorStop(0.1, 'rgba(255,196,96,0.82)');
    glow.addColorStop(0.38, 'rgba(255,128,58,0.34)');
    glow.addColorStop(1, 'rgba(255,128,58,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 390, sun.y - 390, 780, 780);
    const streak = ctx.createLinearGradient(sun.x - width * 0.42, 0, sun.x + width * 0.42, 0);
    streak.addColorStop(0, 'rgba(255,170,90,0)');
    streak.addColorStop(0.5, 'rgba(255,214,140,0.5)');
    streak.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(sun.x - width * 0.42, sun.y - 3, width * 0.84, 6);
    const disc = ctx.createRadialGradient(sun.x, sun.y, 2, sun.x, sun.y, 34);
    disc.addColorStop(0, '#fff7d6');
    disc.addColorStop(0.72, '#ffd98a');
    disc.addColorStop(1, '#ff9e4f');
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 30, 0, Math.PI * 2); ctx.fill();
  }
  // Two haze layers stack the depth: a mauve far band under a warm near
  // band, so headlands and the far coast melt into the sunset in steps.
  const farTop = Math.max(0, horizon - height * 0.2);
  const farHaze = ctx.createLinearGradient(0, farTop, 0, Math.min(height, horizon + height * 0.1));
  farHaze.addColorStop(0, 'rgba(168,118,150,0)');
  farHaze.addColorStop(0.6, 'rgba(168,118,150,0.30)');
  farHaze.addColorStop(1, 'rgba(168,118,150,0)');
  ctx.fillStyle = farHaze;
  ctx.fillRect(0, farTop, width, Math.min(height, horizon + height * 0.1) - farTop);
  const hazeTop = Math.max(0, horizon - height * 0.1);
  const haze = ctx.createLinearGradient(0, hazeTop, 0, Math.min(height, horizon + height * 0.16));
  haze.addColorStop(0, 'rgba(255,170,110,0)');
  haze.addColorStop(0.55, 'rgba(255,170,110,0.42)');
  haze.addColorStop(1, 'rgba(255,170,110,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hazeTop, width, Math.min(height, horizon + height * 0.16) - hazeTop);
}

export function drawSea(ctx, width, height, view, time) {
  const corners = [
    [-WORLD_SIZE, -WORLD_SIZE], [WORLD_SIZE, -WORLD_SIZE],
    [WORLD_SIZE, WORLD_SIZE], [-WORLD_SIZE, WORLD_SIZE],
  ].map(([x, z]) => projectPoint(view, x, 0, z));
  if (corners.some((p) => !p)) return;
  // Sea shading: violet-blue water warming toward the sunset horizon.
  const seaGrad = ctx.createLinearGradient(0, height * 0.4, 0, height);
  seaGrad.addColorStop(0, '#7a5a7d');
  seaGrad.addColorStop(0.35, '#3d5a86');
  seaGrad.addColorStop(0.72, '#274a73');
  seaGrad.addColorStop(1, '#17365c');
  ctx.fillStyle = seaGrad;
  ctx.beginPath();
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  // Sun glitter path: a reflected lane of light under the sun, bright
  // dashes gathering in a widening column over a soft reflection wash.
  const sun = projectPoint(view, view.cam.x + SUNSET.x, 2, view.cam.z + SUNSET.z);
  if (sun) {
    const lane = ctx.createLinearGradient(0, height * 0.48, 0, height);
    lane.addColorStop(0, 'rgba(255,180,100,0.30)');
    lane.addColorStop(1, 'rgba(255,150,80,0.05)');
    ctx.fillStyle = lane;
    ctx.beginPath();
    ctx.moveTo(sun.x - 34, height * 0.48);
    ctx.lineTo(sun.x + 34, height * 0.48);
    ctx.lineTo(sun.x + width * 0.22, height);
    ctx.lineTo(sun.x - width * 0.22, height);
    ctx.closePath(); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 150; i++) {
    const t = i / 150;
    const jitter = Math.sin(i * 127.1) * 43758.5453;
    const spread = 22 + t * 230;
    const gx = sun ? sun.x + ((jitter - Math.floor(jitter)) - 0.5) * spread * 2 : (i * 173) % width;
    const gy = height * 0.5 + t * height * 0.48 + Math.sin(time * 1.7 + i * 2.3) * 2;
    if (gy < 0 || gy > height) continue;
    const w = 4 + t * 24 + Math.sin(time * 2.4 + i) * 2.5;
    ctx.strokeStyle = `rgba(255,${190 + Math.floor(t * 40)},110,${0.3 + t * 0.45})`;
    ctx.lineWidth = 1.3 + t * 1.9;
    ctx.beginPath(); ctx.moveTo(gx - w, gy); ctx.lineTo(gx + w, gy); ctx.stroke();
  }
  // Wave sparkle across the whole bay keeps the water alive at dusk.
  ctx.strokeStyle = 'rgba(190,215,255,0.30)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 44; i++) {
    const gx = view.cam.x + ((i * 613) % 1600) - 800;
    const gz = view.cam.z + ((i * 389) % 1600) - 800;
    const p = projectPoint(view, gx, 0.4, gz);
    if (!p || p.x < 0 || p.x > width || p.y < 0 || p.y > height) continue;
    const w = 5 + (i % 5) * 2.5;
    ctx.beginPath(); ctx.moveTo(p.x - w, p.y); ctx.lineTo(p.x + w, p.y); ctx.stroke();
  }
}

export function drawTerrainMesh(ctx, view, heights, camera) {
  const quads = [];
  const step = 1; // full grid resolution keeps the coastline readable
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
      // Face lighting against the low western sun: west-facing slopes catch
      // the last light, east-facing ones fall into mauve shadow. A coarse
      // block tint and warm distance haze dissolve the grid into dusk ground.
      const gradX = (b.y - a.y + c.y - d.y) / (2 * step * CELL_METRES);
      const gradZ = (d.y - a.y + c.y - b.y) / (2 * step * CELL_METRES);
      const light = 0.86 + gradX * 0.78 + gradZ * 0.26;
      const blockHash = Math.sin(Math.floor(gx / 6) * 127.1 + Math.floor(gz / 6) * 311.7) * 43758.5453;
      const patch = blockHash - Math.floor(blockHash);
      const midX = (a.x + c.x) / 2, midZ = (a.z + c.z) / 2;
      const cityDist = Math.hypot((midX - CITY_CENTRE.x) / 620, (midZ - CITY_CENTRE.z) / 900);
      const urban = Math.max(0, Math.min(1, 1.15 - cityDist));
      // Two depth bands: warm air in the middle distance, mauve air far off.
      const hazeAmt = Math.max(0, Math.min(0.42, (depth - 800) / 2400));
      const farAmt = Math.max(0, Math.min(0.38, (depth - 1900) / 2600));
      quads.push({ pa, pb, pc, pd, depth, colour: groundColour(avgH, slope, patch, light, urban), avgH, hazeAmt, farAmt });
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
      ctx.fillStyle = `rgba(255,166,108,${q.hazeAmt.toFixed(3)})`;
      ctx.fill();
    }
    if (q.farAmt > 0.02) {
      ctx.fillStyle = `rgba(158,112,148,${q.farAmt.toFixed(3)})`;
      ctx.fill();
    }
  }
  drawCityStreets(ctx, view, heights);
}

// The city's street grid: avenues parallel to the shore, cross streets,
// a beach promenade with a foam line, and streetlights coming on at dusk.
function drawCityStreets(ctx, view, heights) {
  ctx.lineCap = 'round';
  const drawRoute = (points, colour, metres) => {
    let prev = null;
    for (const [x, z] of points) {
      const p = projectPoint(view, x, terrainHeightAt(heights, x, z) + 0.6, z);
      if (p && prev) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(1, p.scale * metres);
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      prev = p;
    }
  };
  // Avenues and cross streets read as dark ribbons on the urban shelf.
  for (const avenueX of [-190, -70, 55, 180, 305, 430]) {
    drawRoute([[avenueX, -1080], [avenueX, 720]], 'rgba(43,40,52,0.9)', 7);
  }
  for (let z = -1035; z <= 675; z += 92) {
    drawRoute([[-260, z], [500, z]], 'rgba(43,40,52,0.82)', 5.5);
  }
  // Coast road to the runway and the headland track to the lighthouse.
  drawRoute([[430, 420], [360, 620], [RUNWAY.x, 900]], 'rgba(52,46,54,0.9)', 7);
  drawRoute([[-70, -980], [-210, -1240], [LIGHTHOUSE.x, LIGHTHOUSE.z]], 'rgba(52,46,54,0.85)', 5);
  // Beach promenade follows the shoreline; a pale foam line edges the water.
  const promenade = [], foam = [];
  for (let z = -1250; z <= 950; z += 90) {
    promenade.push([shorelineX(z) + 55, z]);
    foam.push([shorelineX(z) + 6, z]);
  }
  drawRoute(promenade, 'rgba(232,196,150,0.95)', 6);
  drawRoute(foam, 'rgba(255,240,220,0.75)', 2.5);
  // Streetlights: warm points with soft halos along the avenues, and
  // brighter cross-street lights downtown so the grid glows as a network.
  for (const avenueX of [-190, -70, 55, 180, 305, 430]) {
    for (let z = -1040; z <= 680; z += 56) {
      const p = projectPoint(view, avenueX + 6, terrainHeightAt(heights, avenueX, z) + 3, z);
      if (!p || p.depth > 2400) continue;
      const r = Math.max(1.1, p.scale * 1.5);
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.4);
      halo.addColorStop(0, 'rgba(255,206,110,0.55)');
      halo.addColorStop(1, 'rgba(255,206,110,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,226,160,0.95)';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
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
  // Approach light bars south of the threshold guide the final at dusk,
  // each with a halo, ending in green threshold lights at the strip.
  for (let i = 1; i <= 5; i++) {
    const p = projectPoint(view, RUNWAY.x, y + 0.7, RUNWAY.z1 + i * 55);
    if (!p) continue;
    const w = Math.max(4, p.scale * (10 + i * 2));
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, w * 0.8);
    halo.addColorStop(0, 'rgba(255,224,130,0.4)');
    halo.addColorStop(1, 'rgba(255,224,130,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 0.8, w * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,170,0.95)';
    ctx.lineWidth = Math.max(1.5, p.scale * 1.4);
    ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y); ctx.stroke();
  }
  for (const side of [-1, 1]) {
    const p = projectPoint(view, RUNWAY.x + side * (half - 2), y + 0.6, RUNWAY.z1 - 4);
    if (!p) continue;
    const r = Math.max(1.8, p.scale * 1.8);
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
    halo.addColorStop(0, 'rgba(90,255,150,0.9)');
    halo.addColorStop(1, 'rgba(90,255,150,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2); ctx.fill();
  }
  // A small lit terminal and apron east of the strip make it an airport.
  const term = projectPoint(view, RUNWAY.x + 95, y + 16, (RUNWAY.z0 + RUNWAY.z1) / 2);
  if (term) {
    const tw = Math.max(8, term.scale * 62), th = Math.max(4, term.scale * 16);
    ctx.fillStyle = '#3a3049';
    ctx.fillRect(term.x - tw / 2, term.y, tw, th);
    ctx.fillStyle = '#241c33';
    ctx.fillRect(term.x - tw / 2 - 2, term.y - 3, tw + 4, 4);
    ctx.fillStyle = 'rgba(255,214,130,0.95)';
    for (let i = 0; i < 6; i++) ctx.fillRect(term.x - tw / 2 + 4 + i * (tw / 6), term.y + th * 0.35, Math.max(2, tw / 14), Math.max(2, th * 0.3));
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

export function drawCityAndHarbor(ctx, view, heights, buildings, time) {
  const drawn = [];
  for (const b of buildings) {
    const baseY = terrainHeightAt(heights, b.x, b.z);
    const p = projectPoint(view, b.x, baseY + b.height, b.z);
    if (!p || p.depth > 2800) continue;
    drawn.push({ b, p, baseY });
  }
  drawn.sort((d1, d2) => d2.p.depth - d1.p.depth);
  for (const { b, p } of drawn) {
    const w = Math.max(2, b.width * p.scale * 0.58);
    const h = Math.max(2, b.height * p.scale);
    const depthPx = Math.max(1.5, b.depth * p.scale * 0.3);
    // Long dusk shadow thrown east from the base, then the lit west face
    // and the blue-shadow east face: every block reads as a solid volume.
    ctx.fillStyle = 'rgba(24,20,44,0.28)';
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2, p.y + h);
    ctx.lineTo(p.x + w / 2 + depthPx + h * 0.34, p.y + h + depthPx * 0.18);
    ctx.lineTo(p.x + w / 2 + depthPx + h * 0.34, p.y + h + depthPx * 0.18 + 3);
    ctx.lineTo(p.x - w / 2, p.y + h + 3);
    ctx.closePath(); ctx.fill();
    const westLight = 46 + (b.litSeed % 10);
    ctx.fillStyle = `hsl(${b.hue}, 44%, ${westLight}%)`;
    ctx.fillRect(p.x - w / 2, p.y, w, h);
    ctx.fillStyle = `hsl(232, 26%, ${26 + (b.litSeed % 7)}%)`;
    ctx.beginPath();
    ctx.moveTo(p.x + w / 2, p.y); ctx.lineTo(p.x + w / 2 + depthPx, p.y - depthPx * 0.5);
    ctx.lineTo(p.x + w / 2 + depthPx, p.y + h - depthPx * 0.5); ctx.lineTo(p.x + w / 2, p.y + h);
    ctx.closePath(); ctx.fill();
    // Flat dusk roof slab; towers carry a mast and a red beacon.
    ctx.fillStyle = `hsl(${b.roofHue}, 24%, ${20 + (b.litSeed % 5)}%)`;
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2 - 1, p.y); ctx.lineTo(p.x + w / 2 + depthPx, p.y - depthPx * 0.5);
    ctx.lineTo(p.x + w / 2 + depthPx, p.y - depthPx * 0.5 + 2.5); ctx.lineTo(p.x - w / 2 - 1, p.y + 2.5);
    ctx.closePath(); ctx.fill();
    if (b.tower && w > 7) {
      ctx.strokeStyle = 'rgba(230,238,250,0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x + depthPx * 0.3, p.y - 2); ctx.lineTo(p.x + depthPx * 0.3, p.y - Math.max(6, h * 0.1)); ctx.stroke();
      if (Math.sin(time * 2.2 + b.litSeed) > 0.1) {
        ctx.fillStyle = '#ff5a4d';
        ctx.beginPath(); ctx.arc(p.x + depthPx * 0.3, p.y - Math.max(6, h * 0.1), 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Sunset rim on the west top edge keeps every block modelled, not flat.
    ctx.strokeStyle = 'rgba(255,196,120,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2, p.y + h); ctx.lineTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y);
    ctx.stroke();
    // Landmark crowns glow: a lit band and beacon cap the tallest towers.
    if (b.landmark && w > 10) {
      ctx.fillStyle = 'rgba(255,214,130,0.95)';
      ctx.fillRect(p.x - w / 2, p.y + 2, w, Math.max(2.5, h * 0.035));
      ctx.fillStyle = 'rgba(255,160,90,0.35)';
      ctx.fillRect(p.x - w / 2, p.y + 2 + Math.max(2.5, h * 0.035), w, Math.max(3, h * 0.05));
    }
    // Windows: dense dusk lights, warm and uneven across the facade.
    if (w > 6 && h > 8) {
      const cols = Math.max(1, Math.floor(w / 5.4)), rows = Math.max(1, Math.floor(h / 6.8));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const litWin = (r * 13 + c * 7 + b.litSeed) % 5 !== 0;
        const warm = (r * 7 + c * 11 + b.litSeed) % 4 === 0;
        ctx.fillStyle = litWin ? (warm ? 'rgba(255,186,110,0.97)' : 'rgba(255,226,160,0.96)') : 'rgba(30,38,66,0.8)';
        ctx.fillRect(p.x - w / 2 + 1.6 + c * 5.4, p.y + 2.6 + r * 6.8, 2.5, 3.3);
      }
    }
  }
  drawHarbor(ctx, view, heights, time);
  // Lighthouse on the north headland, beam sweeping the darkening sea.
  const lhBase = terrainHeightAt(heights, LIGHTHOUSE.x, LIGHTHOUSE.z);
  const top = projectPoint(view, LIGHTHOUSE.x, lhBase + 58, LIGHTHOUSE.z);
  const foot = projectPoint(view, LIGHTHOUSE.x, lhBase, LIGHTHOUSE.z);
  if (top && foot) {
    const w = Math.max(3, top.scale * 7);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#f2e7dc' : '#c0392b';
      const y0 = foot.y - (foot.y - top.y) * (i / 5);
      const y1 = foot.y - (foot.y - top.y) * ((i + 1) / 5);
      ctx.fillRect(top.x - w / 2, y1, w, y0 - y1);
    }
    ctx.fillStyle = '#22303f';
    ctx.fillRect(top.x - w * 0.7, top.y - 6, w * 1.4, 7);
    const beamAngle = time * 0.7;
    ctx.fillStyle = 'rgba(255,240,170,0.32)';
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - 3);
    ctx.lineTo(top.x + Math.cos(beamAngle) * 220, top.y - 3 + Math.sin(beamAngle) * 40 - 14);
    ctx.lineTo(top.x + Math.cos(beamAngle) * 220, top.y - 3 + Math.sin(beamAngle) * 40 + 14);
    ctx.closePath(); ctx.fill();
  }
}

// Pier, cranes, breakwater and boats: the harbour the cargo mission serves.
function drawHarbor(ctx, view, heights, time) {
  const pierA = projectPoint(view, HARBOR.x + 90, 3, HARBOR.z - 40);
  const pierB = projectPoint(view, HARBOR.x - 230, 3, HARBOR.z + 70);
  if (pierA && pierB) {
    ctx.strokeStyle = '#4c4250';
    ctx.lineWidth = Math.max(2, pierA.scale * 9);
    ctx.beginPath(); ctx.moveTo(pierA.x, pierA.y); ctx.lineTo(pierB.x, pierB.y); ctx.stroke();
  }
  // Two harbour cranes silhouetted against the sunset.
  for (const [cx, cz] of [[HARBOR.x - 40, HARBOR.z - 20], [HARBOR.x - 150, HARBOR.z + 40]]) {
    const base = projectPoint(view, cx, terrainHeightAt(heights, cx, cz), cz);
    const topP = projectPoint(view, cx, terrainHeightAt(heights, cx, cz) + 52, cz);
    if (!base || !topP || base.depth > 2600) continue;
    ctx.strokeStyle = '#2c2438';
    ctx.lineWidth = Math.max(1.5, base.scale * 2.2);
    ctx.beginPath();
    ctx.moveTo(base.x - 6, base.y); ctx.lineTo(topP.x, topP.y); ctx.lineTo(base.x + 6, base.y);
    ctx.moveTo(topP.x, topP.y); ctx.lineTo(topP.x - Math.max(12, base.scale * 26), topP.y + 4);
    ctx.stroke();
  }
  const boats = [[-520, 90, '#c0392b'], [-560, 210, '#e8eef2'], [-470, 300, '#2471a3'], [-600, -40, '#e8eef2']];
  for (const [bx, bz, hull] of boats) {
    const p = projectPoint(view, bx, 1 + Math.sin(time * 1.3 + bx) * 0.4, bz);
    if (!p || p.depth > 2600) continue;
    const w = Math.max(3, p.scale * 16), h = Math.max(2, p.scale * 4.5);
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y);
    ctx.lineTo(p.x + w * 0.34, p.y + h); ctx.lineTo(p.x - w * 0.34, p.y + h);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,220,0.9)';
    ctx.lineWidth = Math.max(1, p.scale * 0.8);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - h * 2.6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,244,226,0.94)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h * 2.6); ctx.lineTo(p.x + w * 0.3, p.y - h * 0.3); ctx.lineTo(p.x, p.y - h * 0.3);
    ctx.closePath(); ctx.fill();
  }
}

export function drawClouds(ctx, view, clouds) {
  const visible = [];
  for (const cloud of clouds) {
    const p = projectPoint(view, cloud.x, cloud.y, cloud.z);
    // Clouds nearer than 650 m would swell into a wall across the frame.
    if (p && p.depth > 650 && p.depth < 4200) visible.push({ cloud, p });
  }
  visible.sort((a, b) => b.p.depth - a.p.depth);
  for (const { cloud, p } of visible) {
    const r = Math.min(240, cloud.radius * p.scale);
    if (r < 4) continue;
    const haze = Math.max(0, Math.min(0.5, (p.depth - 1600) / 4200));
    // Layered puffs at dusk: violet bellies first, rose-lit crowns on top,
    // each puff a soft radial gradient so the cloud keeps its volume.
    for (let i = 0; i < cloud.puffs; i++) {
      const ox = (i - (cloud.puffs - 1) / 2) * r * 0.5;
      const oy = Math.sin(i * 2.1 + cloud.drift * 6) * r * 0.09;
      const pr = r * (0.5 + (i % 3) * 0.09);
      const belly = ctx.createRadialGradient(p.x + ox, p.y + oy + pr * 0.25, 1, p.x + ox, p.y + oy + pr * 0.25, pr);
      belly.addColorStop(0, `rgba(96,72,116,${0.55 * cloud.tone})`);
      belly.addColorStop(1, 'rgba(96,72,116,0)');
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(p.x + ox, p.y + oy + pr * 0.22, pr, pr * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      const crown = ctx.createRadialGradient(p.x + ox - pr * 0.2, p.y + oy - pr * 0.2, 1, p.x + ox, p.y + oy, pr);
      crown.addColorStop(0, `rgba(255,196,160,${0.92 * cloud.tone})`);
      crown.addColorStop(0.65, `rgba(240,150,140,${0.72 * cloud.tone})`);
      crown.addColorStop(1, 'rgba(240,150,140,0)');
      ctx.fillStyle = crown;
      ctx.beginPath(); ctx.ellipse(p.x + ox, p.y + oy, pr, pr * 0.52, 0, 0, Math.PI * 2); ctx.fill();
      // A bright rim arc on the sunward crown edge lifts the cloud off the sky.
      ctx.strokeStyle = `rgba(255,222,170,${0.5 * cloud.tone})`;
      ctx.lineWidth = Math.max(1, pr * 0.05);
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy, pr * 0.92, pr * 0.46, 0, Math.PI * 1.05, Math.PI * 1.72);
      ctx.stroke();
    }
    if (haze > 0.03) {
      ctx.fillStyle = `rgba(255,166,108,${haze.toFixed(3)})`;
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

// The V-wing's chevron shadow on the ground below sells its height and
// its shape at a glance.
export function drawAircraftShadow(ctx, view, aircraft, heights) {
  const groundY = Math.max(0, terrainHeightAt(heights, aircraft.x, aircraft.z));
  const p = projectPoint(view, aircraft.x, groundY + 0.4, aircraft.z);
  if (!p) return;
  const heightAbove = Math.max(0, aircraft.y - groundY);
  const spread = Math.max(7, (30 + heightAbove * 0.13) * p.scale);
  const alpha = Math.max(0.06, Math.min(0.36, 0.38 - heightAbove * 0.0009));
  ctx.fillStyle = `rgba(18,24,44,${alpha.toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(p.x - spread, p.y + spread * 0.1);
  ctx.lineTo(p.x, p.y - spread * 0.16);
  ctx.lineTo(p.x + spread, p.y + spread * 0.1);
  ctx.lineTo(p.x + spread * 0.82, p.y + spread * 0.3);
  ctx.lineTo(p.x, p.y + spread * 0.08);
  ctx.lineTo(p.x - spread * 0.82, p.y + spread * 0.3);
  ctx.closePath(); ctx.fill();
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
