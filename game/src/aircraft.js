// aircraft.js — draws the Sunwing courier plane: a detailed chase-view
// aircraft that banks with the pilot, and the cockpit panel for cockpit view.

export function drawChaseAircraft(ctx, width, height, aircraft, time) {
  const cx = width / 2;
  const cy = height * 0.66 + aircraft.pitch * height * 0.16;
  const scale = height / 800;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-aircraft.roll * 0.85);
  ctx.scale(scale, scale);

  const wingSpan = 330, wingY = 6;
  // Main wing with aileron shading and red tips.
  ctx.fillStyle = '#e8edf2';
  ctx.beginPath();
  ctx.moveTo(-wingSpan / 2, wingY + 14);
  ctx.lineTo(-30, wingY - 8);
  ctx.lineTo(30, wingY - 8);
  ctx.lineTo(wingSpan / 2, wingY + 14);
  ctx.lineTo(wingSpan / 2 - 8, wingY + 26);
  ctx.lineTo(-wingSpan / 2 + 8, wingY + 26);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d23b2e';
  ctx.fillRect(-wingSpan / 2, wingY + 12, 26, 12);
  ctx.fillRect(wingSpan / 2 - 26, wingY + 12, 26, 12);
  ctx.fillStyle = 'rgba(90,110,140,0.35)';
  ctx.fillRect(-wingSpan / 2 + 30, wingY + 20, wingSpan - 60, 3);

  // Tailplane and fin.
  ctx.fillStyle = '#dfe6ee';
  ctx.beginPath();
  ctx.moveTo(-78, 58); ctx.lineTo(78, 58); ctx.lineTo(66, 70); ctx.lineTo(-66, 70);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d23b2e';
  ctx.beginPath();
  ctx.moveTo(-7, 58); ctx.lineTo(0, 16); ctx.lineTo(10, 58);
  ctx.closePath(); ctx.fill();

  // Fuselage: tapered body, spine stripe, canopy glass.
  const body = ctx.createLinearGradient(-34, 0, 34, 0);
  body.addColorStop(0, '#c9d4e0'); body.addColorStop(0.5, '#f4f7fa'); body.addColorStop(1, '#b9c7d6');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-26, 64);
  ctx.quadraticCurveTo(-34, -6, -20, -52);
  ctx.quadraticCurveTo(0, -66, 20, -52);
  ctx.quadraticCurveTo(34, -6, 26, 64);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d23b2e';
  ctx.fillRect(-4, -58, 8, 122);
  ctx.fillStyle = '#1d3a52';
  ctx.beginPath();
  ctx.ellipse(0, -34, 15, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,220,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(-5, -40, 6, 9, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Pilot's helmet dot inside the canopy.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI * 2); ctx.fill();

  // Propeller: blurred disc, blades and spinner, spinning with throttle.
  const propY = -62;
  ctx.fillStyle = 'rgba(40,50,65,0.28)';
  ctx.beginPath(); ctx.ellipse(0, propY, 52, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,38,50,0.8)';
  ctx.lineWidth = 4;
  const phase = time * (6 + aircraft.throttle * 40);
  for (let i = 0; i < 2; i++) {
    const a = phase + i * Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * -48, propY + Math.sin(a) * 5);
    ctx.lineTo(Math.cos(a) * 48, propY - Math.sin(a) * 5);
    ctx.stroke();
  }
  ctx.fillStyle = '#d23b2e';
  ctx.beginPath(); ctx.ellipse(0, propY, 8, 6, 0, 0, Math.PI * 2); ctx.fill();

  // Landing gear when low, nav lights at the wingtips.
  if (aircraft.gearDown) {
    ctx.strokeStyle = '#33404f'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-30, 30); ctx.lineTo(-38, 52);
    ctx.moveTo(30, 30); ctx.lineTo(38, 52);
    ctx.stroke();
    ctx.fillStyle = '#222a33';
    ctx.beginPath(); ctx.arc(-40, 56, 7, 0, Math.PI * 2); ctx.arc(40, 56, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff4444';
  ctx.beginPath(); ctx.arc(-wingSpan / 2 + 4, wingY + 16, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#39d353';
  ctx.beginPath(); ctx.arc(wingSpan / 2 - 4, wingY + 16, 4, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

export function drawCockpitPanel(ctx, width, height, aircraft, instruments) {
  const panelTop = height * 0.62;
  // Nose and prop arc above the panel.
  ctx.fillStyle = 'rgba(30,38,50,0.25)';
  ctx.beginPath(); ctx.ellipse(width / 2, panelTop - 6, width * 0.16, 14, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#d23b2e';
  ctx.beginPath(); ctx.ellipse(width / 2, panelTop - 8, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Glareshield and panel body.
  ctx.fillStyle = '#16222f';
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
