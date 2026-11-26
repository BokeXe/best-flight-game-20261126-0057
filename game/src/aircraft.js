// aircraft.js — the cockpit panel overlay for cockpit view: the blended
// V-wing nose silhouette and the instrument cluster the HUD draws into.
// The airframe itself is true 3D geometry in gl-aircraft.js.

export function drawCockpitPanel(ctx, width, height, aircraft, instruments) {
  const panelTop = height * 0.62;
  // Blended V-wing nose above the panel: a low pod spine with the two
  // wing roots sweeping away at the frame edges.
  ctx.fillStyle = 'rgba(64,48,66,0.55)';
  ctx.beginPath();
  ctx.moveTo(width * 0.16, panelTop + 16);
  ctx.quadraticCurveTo(width * 0.42, panelTop - 20, width / 2, panelTop - 24);
  ctx.quadraticCurveTo(width * 0.58, panelTop - 20, width * 0.84, panelTop + 16);
  ctx.lineTo(width * 0.8, panelTop + 24);
  ctx.quadraticCurveTo(width / 2, panelTop - 6, width * 0.2, panelTop + 24);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,206,120,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.2, panelTop + 10);
  ctx.quadraticCurveTo(width * 0.44, panelTop - 16, width / 2, panelTop - 20);
  ctx.quadraticCurveTo(width * 0.56, panelTop - 16, width * 0.8, panelTop + 10);
  ctx.stroke();
  ctx.fillStyle = '#c93428';
  ctx.beginPath(); ctx.ellipse(width / 2, panelTop - 14, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Glareshield and panel body in deep dusk plum.
  ctx.fillStyle = '#1d1628';
  ctx.beginPath();
  ctx.moveTo(0, height); ctx.lineTo(0, panelTop + 26);
  ctx.quadraticCurveTo(width / 2, panelTop - 22, width, panelTop + 26);
  ctx.lineTo(width, height);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1f3045';
  ctx.fillRect(0, panelTop + 30, width, 4);
  // Riveted panel plate.
  ctx.fillStyle = '#24384f';
  const px = width * 0.08, pw = width * 0.84, py = panelTop + 44, ph = height - py - 14;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill();
  ctx.fillStyle = '#3c5878';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath(); ctx.arc(px + 14 + i * (pw - 28) / 9, py + 12, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 14 + i * (pw - 28) / 9, py + ph - 12, 3, 0, Math.PI * 2); ctx.fill();
  }
  instruments(ctx, px, py, pw, ph, aircraft);
}
