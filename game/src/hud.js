// hud.js — the pilot's instruments: altitude, speed and heading readouts,
// artificial horizon, compass tape, fuel/throttle/damage gauges, warning
// lights, mission banner, minimap and the off-screen target arrow.

import { headingDegrees, STALL_SPEED } from './flight-model.js';
import { RUNWAY, TOWN_CENTRE, LIGHTHOUSE, WORLD_SIZE } from './terrain.js';

const INK = '#eaf3fb';
const DIM = 'rgba(180,205,230,0.75)';
const AMBER = '#ffd34d';
const RED = '#ff5a4d';
const GREEN = '#39d353';

export function drawHud(ctx, width, height, state) {
  const a = state.aircraft;
  drawMissionBanner(ctx, width, state);
  drawCompassTape(ctx, width, a);
  // In cockpit view the panel carries the instruments; the HUD keeps only
  // the banner, compass, minimap and warnings so nothing overlaps.
  if (!state.cockpitView) {
    drawPrimaryReadouts(ctx, width, height, a);
    drawArtificialHorizon(ctx, width * 0.09, height * 0.8, height * 0.085, a);
    drawGauges(ctx, width, height, a);
  }
  drawMinimap(ctx, width, height, state);
  drawTargetArrow(ctx, width, height, state);
  drawWarningLights(ctx, width, height, a, state.time);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,22,38,0.72)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(140,190,240,0.35)';
  ctx.lineWidth = 1.5; ctx.stroke();
}

function drawMissionBanner(ctx, width, state) {
  const m = state.mission;
  panel(ctx, width / 2 - 300, 14, 600, 58);
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText(m.bannerTitle, width / 2, 40);
  ctx.fillStyle = INK;
  ctx.font = '16px sans-serif';
  ctx.fillText(m.bannerText, width / 2, 63);
  // Score and clock, top right.
  panel(ctx, width - 196, 14, 182, 58);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK; ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`SCORE ${state.score}`, width - 28, 40);
  ctx.fillStyle = DIM; ctx.font = '15px sans-serif';
  ctx.fillText(`TIME ${formatClock(state.missionTime)}`, width - 28, 62);
}

function drawPrimaryReadouts(ctx, width, height, a) {
  const y = height - 118;
  const items = [
    ['ALT', `${Math.round(a.y * 3.28)} ft`],
    ['SPD', `${Math.round(a.speed * 1.94)} kt`],
    ['HDG', `${String(Math.round(headingDegrees(a))).padStart(3, '0')}°`],
    ['V/S', `${a.verticalSpeed >= 0 ? '+' : ''}${Math.round(a.verticalSpeed * 197)}`],
  ];
  const w = 150, gap = 10;
  const x0 = width / 2 - (items.length * w + (items.length - 1) * gap) / 2;
  items.forEach(([label, value], i) => {
    const x = x0 + i * (w + gap);
    panel(ctx, x, y, w, 62);
    ctx.textAlign = 'center';
    ctx.fillStyle = DIM; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(label, x + w / 2, y + 20);
    ctx.fillStyle = label === 'SPD' && a.stalled ? RED
      : label === 'SPD' && a.stallMargin < 9 && !a.onGround ? AMBER : INK;
    ctx.font = 'bold 27px sans-serif';
    ctx.fillText(value, x + w / 2, y + 50);
  });
}

function drawCompassTape(ctx, width, a) {
  const cx = width / 2, y = 86, w = 420;
  panel(ctx, cx - w / 2, y, w, 34);
  const hdg = headingDegrees(a);
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - w / 2 + 4, y + 2, w - 8, 30); ctx.clip();
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 10) {
    const deg = ((Math.round(hdg / 10) * 10 + d) % 360 + 360) % 360;
    const x = cx + (d - (hdg - Math.round(hdg / 10) * 10)) * 3.2;
    if (deg % 30 !== 0) {
      ctx.fillStyle = DIM;
      ctx.fillRect(x - 1, y + 14, 2, 8);
      continue;
    }
    const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg / 10);
    ctx.fillStyle = deg % 90 === 0 ? AMBER : INK;
    ctx.fillText(label, x, y + 23);
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + 2); ctx.lineTo(cx + 6, y + 2); ctx.lineTo(cx, y + 12);
  ctx.closePath(); ctx.fill();
}

export function drawArtificialHorizon(ctx, cx, cy, r, a) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(a.roll);
  const pitchPx = a.pitch * r * 1.6;
  ctx.fillStyle = '#3d8fd1';
  ctx.fillRect(-r * 2, -r * 2 + pitchPx, r * 4, r * 2);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r * 2, pitchPx, r * 4, r * 2);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r * 2, pitchPx); ctx.lineTo(r * 2, pitchPx); ctx.stroke();
  ctx.restore();
  // Fixed aircraft symbol and bezel.
  ctx.strokeStyle = AMBER; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy); ctx.lineTo(cx - r * 0.15, cy); ctx.lineTo(cx, cy + r * 0.14);
  ctx.lineTo(cx + r * 0.15, cy); ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,225,250,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = DIM; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 16);
}

function drawGauges(ctx, width, height, a) {
  const x = width - 230, y = height - 210, w = 216, h = 196;
  panel(ctx, x, y, w, h);
  const rows = [
    ['FUEL', a.fuel / 100, a.fuel < 20 ? RED : GREEN, `${Math.round(a.fuel)}%`],
    ['THROTTLE', a.throttle, AMBER, `${Math.round(a.throttle * 100)}%`],
    ['AIRFRAME', 1 - a.damage / 100, a.damage > 55 ? RED : GREEN, `${Math.round(100 - a.damage)}%`],
  ];
  rows.forEach(([label, frac, colour, text], i) => {
    const ry = y + 22 + i * 44;
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(label, x + 14, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = INK; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(text, x + w - 14, ry);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.roundRect(x + 14, ry + 8, w - 28, 12, 6); ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.roundRect(x + 14, ry + 8, Math.max(4, (w - 28) * Math.max(0, Math.min(1, frac))), 12, 6); ctx.fill();
  });
  // Gear, flaps and live stall margin under the bars, short labels so the
  // three markers never collide at screenshot size.
  ctx.font = 'bold 12.5px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = a.gearDown ? GREEN : DIM;
  ctx.fillText(a.gearDown ? 'GEAR ▼' : 'GEAR ▲', x + 12, y + h - 16);
  ctx.textAlign = 'center';
  ctx.fillStyle = a.flapsDown ? AMBER : DIM;
  ctx.fillText(a.flapsDown ? 'FLAPS ▼' : 'FLAPS —', x + w / 2, y + h - 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = a.stalled ? RED : a.stallMargin < 9 && !a.onGround ? AMBER : DIM;
  ctx.fillText(a.onGround ? `STALL ${Math.round(STALL_SPEED * 1.94)}kt` : `+${Math.max(0, Math.round(a.stallMargin * 1.94))}kt`, x + w - 12, y + h - 16);
}

function drawMinimap(ctx, width, height, state) {
  const size = 168, x = width - size - 14, y = 84;
  panel(ctx, x, y, size, size);
  const toMap = (wx, wz) => ({
    x: x + size / 2 + (wx / WORLD_SIZE) * size * 0.92,
    y: y + size / 2 + (wz / WORLD_SIZE) * size * 0.92,
  });
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x + 3, y + 3, size - 6, size - 6, 8); ctx.clip();
  ctx.fillStyle = '#1d6fa8'; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#5d9247';
  ctx.beginPath();
  ctx.ellipse(x + size / 2 + 5, y + size / 2, size * 0.34, size * 0.3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  const rw = toMap(RUNWAY.x, (RUNWAY.z0 + RUNWAY.z1) / 2);
  ctx.fillStyle = '#f5f7fa'; ctx.fillRect(rw.x - 2, rw.y - 8, 4, 16);
  const town = toMap(TOWN_CENTRE.x, TOWN_CENTRE.z);
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(town.x, town.y, 3.5, 0, Math.PI * 2); ctx.fill();
  const lh = toMap(LIGHTHOUSE.x, LIGHTHOUSE.z);
  ctx.fillStyle = '#ff5a4d'; ctx.beginPath(); ctx.arc(lh.x, lh.y, 3, 0, Math.PI * 2); ctx.fill();
  const target = state.mission.target;
  if (target) {
    const tp = toMap(target.x, target.z);
    ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tp.x, tp.y, 6 + Math.sin(state.time * 4) * 1.5, 0, Math.PI * 2); ctx.stroke();
  }
  const me = toMap(state.aircraft.x, state.aircraft.z);
  ctx.save();
  ctx.translate(me.x, me.y);
  ctx.rotate(state.aircraft.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = DIM; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('KESTREL BAY', x + size / 2, y + size - 8);
  void height;
}

function drawTargetArrow(ctx, width, height, state) {
  const target = state.mission.target;
  if (!target || !state.view) return;
  const a = state.aircraft;
  const bearing = Math.atan2(target.x - a.x, -(target.z - a.z));
  let diff = bearing - a.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const dist = Math.hypot(target.x - a.x, target.z - a.z);
  if (Math.abs(diff) < 0.5 && dist > 120) return; // target is in view already
  const cx = width / 2, cy = height / 2;
  const rx = width * 0.36, ry = height * 0.3;
  const x = cx + Math.sin(diff) * rx;
  const y = cy - Math.cos(diff) * ry * 0.4 - 40;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(diff);
  ctx.fillStyle = AMBER;
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(11, 10); ctx.lineTo(0, 4); ctx.lineTo(-11, 10);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = AMBER; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist)}m`, x, y + 30);
}

function drawWarningLights(ctx, width, height, a, time) {
  const warnings = [];
  if (a.stalled) warnings.push(['STALL — NOSE DOWN', RED]);
  else if (a.stallMargin < 7 && !a.onGround) warnings.push(['STALL WARNING', AMBER]);
  if (a.fuel < 20 && a.fuel > 0) warnings.push(['LOW FUEL', AMBER]);
  if (a.fuel <= 0) warnings.push(['ENGINE OUT', RED]);
  if (a.damage > 55) warnings.push(['AIRFRAME DAMAGE', RED]);
  warnings.forEach(([label, colour], i) => {
    const blink = Math.sin(time * 6 + i) > -0.2;
    if (!blink && colour === RED) return;
    const x = width / 2 - 90, y = height * 0.3 + i * 36;
    ctx.fillStyle = 'rgba(60,8,8,0.8)';
    ctx.beginPath(); ctx.roundRect(x, y, 180, 30, 8); ctx.fill();
    ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = colour; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, width / 2, y + 21);
  });
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function drawCockpitInstruments(ctx, x, y, w, h, a) {
  // Big round gauges for the cockpit screenshot: attitude, speed, altimeter.
  const cy = y + h * 0.46, r = h * 0.34;
  drawArtificialHorizon(ctx, x + w * 0.2, cy, r, a);
  drawRoundGauge(ctx, x + w * 0.46, cy, r, 'AIRSPEED', Math.round(a.speed * 1.94), 'kt', a.speed / 92);
  drawRoundGauge(ctx, x + w * 0.7, cy, r, 'ALTITUDE', Math.round(a.y * 3.28), 'ft', (a.y % 300) / 300);
  drawRoundGauge(ctx, x + w * 0.92, cy, r * 0.8, 'FUEL', Math.round(a.fuel), '%', a.fuel / 100);
}

function drawRoundGauge(ctx, cx, cy, r, label, value, unit, frac) {
  ctx.fillStyle = '#0d1826';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,225,250,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = AMBER; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, r - 5, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1, frac))); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = `bold ${Math.round(r * 0.5)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(String(value), cx, cy + r * 0.18);
  ctx.fillStyle = DIM; ctx.font = `bold ${Math.round(r * 0.24)}px sans-serif`;
  ctx.fillText(`${label} ${unit}`, cx, cy + r * 0.52);
}
