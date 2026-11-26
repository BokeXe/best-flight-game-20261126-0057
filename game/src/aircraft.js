// aircraft.js — draws the Sunwing courier plane: a detailed chase-view
// aircraft that banks with the pilot, and the cockpit panel for cockpit view.

export function drawChaseAircraft(ctx, width, height, aircraft, time) {
  const cx = width / 2;
  const cy = height * 0.65 + aircraft.pitch * height * 0.16;
  const scale = height / 705; // the plane fills more of the frame
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-aircraft.roll * 0.85);
  ctx.scale(scale, scale);

  const wingSpan = 330, wingY = 6;
  // Main wing: sunset-warm top surface falling to dusk-shaded tips, red
  // tip caps, aileron hinge lines and a golden leading-edge highlight.
  const wingGrad = ctx.createLinearGradient(-wingSpan / 2, 0, wingSpan / 2, 0);
  wingGrad.addColorStop(0, '#e8c9a8');
  wingGrad.addColorStop(0.5, '#fdf3e2');
  wingGrad.addColorStop(1, '#b8a8b8');
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(-wingSpan / 2, wingY + 16);
  ctx.lineTo(-30, wingY - 10);
  ctx.lineTo(30, wingY - 10);
  ctx.lineTo(wingSpan / 2, wingY + 16);
  ctx.lineTo(wingSpan / 2 - 9, wingY + 28);
  ctx.lineTo(-wingSpan / 2 + 9, wingY + 28);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,90,115,0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#d23b2e';
  ctx.beginPath();
  ctx.moveTo(-wingSpan / 2, wingY + 15); ctx.lineTo(-wingSpan / 2 + 30, wingY + 9);
  ctx.lineTo(-wingSpan / 2 + 30, wingY + 24); ctx.lineTo(-wingSpan / 2 + 8, wingY + 27);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(wingSpan / 2, wingY + 15); ctx.lineTo(wingSpan / 2 - 30, wingY + 9);
  ctx.lineTo(wingSpan / 2 - 30, wingY + 24); ctx.lineTo(wingSpan / 2 - 8, wingY + 27);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(90,110,140,0.5)';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 46, wingY + 15); ctx.lineTo(side * (wingSpan / 2 - 34), wingY + 21);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,214,140,0.65)';
  ctx.fillRect(-wingSpan / 2 + 34, wingY + 2, wingSpan - 68, 2.4);

  // Tailplane and fin, shaded like the wing, with a courier sun mark.
  const tailGrad = ctx.createLinearGradient(-78, 0, 78, 0);
  tailGrad.addColorStop(0, '#aebfd2');
  tailGrad.addColorStop(0.5, '#eef3f8');
  tailGrad.addColorStop(1, '#a3b5c9');
  ctx.fillStyle = tailGrad;
  ctx.beginPath();
  ctx.moveTo(-80, 57); ctx.lineTo(80, 57); ctx.lineTo(67, 71); ctx.lineTo(-67, 71);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d23b2e';
  ctx.beginPath();
  ctx.moveTo(-7, 59); ctx.quadraticCurveTo(-2, 30, 1, 15);
  ctx.quadraticCurveTo(7, 32, 10, 59);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath(); ctx.arc(1.5, 44, 3.6, 0, Math.PI * 2); ctx.fill();

  // Fuselage: cylindrical shading (dark flanks, bright spine), panel seams,
  // spine stripe and a glass canopy with a sky reflection streak.
  const body = ctx.createLinearGradient(-36, 0, 36, 0);
  body.addColorStop(0, '#c9a98c');
  body.addColorStop(0.3, '#f0e2cc');
  body.addColorStop(0.5, '#fffaf0');
  body.addColorStop(0.72, '#e2d2c2');
  body.addColorStop(1, '#a898a8');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-26, 64);
  ctx.quadraticCurveTo(-36, -8, -21, -54);
  ctx.quadraticCurveTo(0, -68, 21, -54);
  ctx.quadraticCurveTo(36, -8, 26, 64);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(80,100,125,0.4)';
  ctx.lineWidth = 1.4;
  for (const seamY of [-16, 14, 40]) {
    ctx.beginPath();
    ctx.moveTo(-24, seamY); ctx.quadraticCurveTo(0, seamY + 5, 24, seamY);
    ctx.stroke();
  }
  ctx.fillStyle = '#d23b2e';
  ctx.beginPath();
  ctx.moveTo(-4.5, -60); ctx.lineTo(4.5, -60); ctx.lineTo(3, 62); ctx.lineTo(-3, 62);
  ctx.closePath(); ctx.fill();
  const canopy = ctx.createLinearGradient(-14, -52, 14, -16);
  canopy.addColorStop(0, '#3f6d96');
  canopy.addColorStop(0.45, '#1d3a52');
  canopy.addColorStop(1, '#122639');
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.ellipse(0, -34, 15.5, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,228,250,0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = 'rgba(190,228,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-6, -42, 5, 10, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(6, -26, 3, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Pilot's helmet dot inside the canopy.
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI * 2); ctx.fill();

  // Propeller: translucent blur disc with a bright rim arc, blades and
  // spinner, spinning with throttle.
  const propY = -62;
  const disc = ctx.createRadialGradient(0, propY, 4, 0, propY, 56);
  disc.addColorStop(0, 'rgba(40,50,65,0.1)');
  disc.addColorStop(0.75, 'rgba(40,50,65,0.24)');
  disc.addColorStop(0.97, 'rgba(40,50,65,0.4)');
  disc.addColorStop(1, 'rgba(40,50,65,0)');
  ctx.fillStyle = disc;
  ctx.beginPath(); ctx.ellipse(0, propY, 56, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(230,240,248,0.35)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(0, propY, 54, 8.4, 0, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke();
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
