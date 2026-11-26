// aircraft.js — draws the Sunwing V-wing courier: a swept flying-wing
// aircraft whose two panels meet in a clear V at the centre pod, shaded
// like a built 3D object, plus the cockpit panel for cockpit view.

export function drawChaseAircraft(ctx, width, height, aircraft, time) {
  const cx = width / 2;
  const cy = height * 0.62 + aircraft.pitch * height * 0.16;
  const scale = height / 612; // the V-wing fills the frame, silhouette first
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-aircraft.roll * 0.85);
  ctx.scale(scale, scale);

  // Planform geometry: nose pod at top, leading edges sweeping back to the
  // tips, trailing edges meeting in a shallow centre notch — one bold V.
  const tipX = 196, tipY = 30, noseY = -74, notchY = 16;
  const panelPath = (side) => {
    ctx.beginPath();
    ctx.moveTo(side * 14, noseY + 8);
    ctx.quadraticCurveTo(side * 96, -34, side * tipX, tipY - 6);
    ctx.lineTo(side * (tipX - 7), tipY + 9);
    ctx.quadraticCurveTo(side * 92, 26, 0, notchY);
    ctx.quadraticCurveTo(side * 20, -18, side * 14, noseY + 8);
    ctx.closePath();
  };
  // Soft drop shadow under the wing so it floats over the city, not on it.
  ctx.fillStyle = 'rgba(16,10,28,0.30)';
  ctx.beginPath();
  ctx.moveTo(-tipX + 6, tipY + 16); ctx.lineTo(0, notchY + 20); ctx.lineTo(tipX - 6, tipY + 16);
  ctx.lineTo(tipX - 20, tipY + 26); ctx.lineTo(0, notchY + 30); ctx.lineTo(-tipX + 20, tipY + 26);
  ctx.closePath(); ctx.fill();

  for (const side of [-1, 1]) {
    // Top surface: sunset light falls from the west panel to dusk shade.
    const grad = ctx.createLinearGradient(side * 10, noseY, side * tipX, tipY + 12);
    grad.addColorStop(0, side < 0 ? '#f6e3c2' : '#e9d6c4');
    grad.addColorStop(0.55, side < 0 ? '#e8c9a4' : '#cbb4b4');
    grad.addColorStop(1, side < 0 ? '#b08d84' : '#8d7d94');
    ctx.fillStyle = grad;
    panelPath(side); ctx.fill();
    // Underside shading band along the trailing edge gives the panel volume.
    ctx.fillStyle = 'rgba(58,44,72,0.35)';
    ctx.beginPath();
    ctx.moveTo(side * (tipX - 7), tipY + 9);
    ctx.quadraticCurveTo(side * 92, 26, 0, notchY);
    ctx.quadraticCurveTo(side * 92, 18, side * (tipX - 12), tipY + 2);
    ctx.closePath(); ctx.fill();
    // Panel seams and a spar line read as built structure at any size.
    ctx.strokeStyle = 'rgba(88,72,92,0.45)';
    ctx.lineWidth = 1.5;
    for (const f of [0.34, 0.58, 0.8]) {
      ctx.beginPath();
      ctx.moveTo(side * (14 + (tipX - 14) * f), noseY + 8 + (tipY - noseY) * f * 0.82);
      ctx.lineTo(side * (tipX * f), notchY + (tipY - notchY) * f + 6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(side * 30, -30); ctx.quadraticCurveTo(side * 110, 2, side * (tipX - 18), tipY - 2);
    ctx.stroke();
    // Wingtip cap in courier red with the sun mark.
    ctx.fillStyle = '#c93428';
    ctx.beginPath();
    ctx.moveTo(side * (tipX - 34), tipY - 12); ctx.lineTo(side * tipX, tipY - 6);
    ctx.lineTo(side * (tipX - 7), tipY + 9); ctx.lineTo(side * (tipX - 36), tipY + 4);
    ctx.closePath(); ctx.fill();
    // Golden leading-edge rim light from the low sun.
    ctx.strokeStyle = 'rgba(255,206,120,0.85)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(side * 16, noseY + 9);
    ctx.quadraticCurveTo(side * 96, -34, side * (tipX - 4), tipY - 6);
    ctx.stroke();
    // Elevon: deflects with pitch and roll input like a real control surface.
    const deflect = Math.max(-9, Math.min(9, aircraft.pitch * 26 + side * aircraft.roll * 12));
    ctx.fillStyle = side < 0 ? '#d9bd9c' : '#b7a3ae';
    ctx.beginPath();
    ctx.moveTo(side * 62, 22 + deflect * 0.35);
    ctx.lineTo(side * 150, 30 + deflect * 0.35);
    ctx.lineTo(side * 148, 38 + deflect);
    ctx.lineTo(side * 64, 31 + deflect);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70,56,80,0.5)'; ctx.lineWidth = 1.3; ctx.stroke();
    // Canted fin near each tip, leaning outward over the trailing edge.
    ctx.fillStyle = side < 0 ? '#a33b34' : '#8e3a3e';
    ctx.beginPath();
    ctx.moveTo(side * 118, 24);
    ctx.lineTo(side * 132, -16);
    ctx.lineTo(side * 144, -12);
    ctx.lineTo(side * 140, 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(side * 132, 2, 3.4, 0, Math.PI * 2); ctx.fill();
  }

  // Centre pod: blended spine with cylindrical shading, intake bumps and
  // a tinted canopy whose streak mirrors the sunset sky.
  const pod = ctx.createLinearGradient(-30, 0, 30, 0);
  pod.addColorStop(0, '#c3a184');
  pod.addColorStop(0.32, '#f3e4ca');
  pod.addColorStop(0.52, '#fff8ec');
  pod.addColorStop(0.74, '#e0cbb6');
  pod.addColorStop(1, '#9d8aa0');
  ctx.fillStyle = pod;
  ctx.beginPath();
  ctx.moveTo(-17, 30);
  ctx.quadraticCurveTo(-27, -26, -13, -62);
  ctx.quadraticCurveTo(0, noseY, 13, -62);
  ctx.quadraticCurveTo(27, -26, 17, 30);
  ctx.quadraticCurveTo(0, 38, -17, 30);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(96,76,92,0.4)'; ctx.lineWidth = 1.3;
  for (const seamY of [-8, 12]) {
    ctx.beginPath();
    ctx.moveTo(-19, seamY); ctx.quadraticCurveTo(0, seamY + 5, 19, seamY);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(70,58,84,0.55)';
    ctx.beginPath();
    ctx.ellipse(side * 19, -14, 6.5, 11, side * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  const canopy = ctx.createLinearGradient(-13, -58, 13, -22);
  canopy.addColorStop(0, '#7fb2d9');
  canopy.addColorStop(0.4, '#2c5878');
  canopy.addColorStop(1, '#142c44');
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.ellipse(0, -40, 13.5, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,234,252,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = 'rgba(255,196,140,0.85)';
  ctx.beginPath();
  ctx.ellipse(-5, -49, 4.6, 9, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(0, -36, 4.6, 0, Math.PI * 2); ctx.fill();
  // Spine stripe runs nose to notch, tying the V together.
  ctx.fillStyle = '#c93428';
  ctx.beginPath();
  ctx.moveTo(-3.4, -66); ctx.lineTo(3.4, -66); ctx.lineTo(2.2, 30); ctx.lineTo(-2.2, 30);
  ctx.closePath(); ctx.fill();

  // Twin exhausts at the notch glow with throttle; heat shimmer trails aft.
  const glow = 0.35 + aircraft.throttle * 0.65;
  for (const side of [-1, 1]) {
    const ex = side * 9;
    const jet = ctx.createRadialGradient(ex, 34, 1, ex, 34, 15);
    jet.addColorStop(0, `rgba(255,240,190,${0.95 * glow})`);
    jet.addColorStop(0.45, `rgba(255,150,70,${0.6 * glow})`);
    jet.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = jet;
    ctx.beginPath(); ctx.ellipse(ex, 38, 8, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c2434';
    ctx.beginPath(); ctx.ellipse(ex, 31, 5.4, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = `rgba(255,190,120,${0.22 * glow})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-7 + i * 7, 44);
    ctx.quadraticCurveTo(-9 + i * 7 + Math.sin(time * 9 + i) * 2, 56, -7 + i * 7, 68);
    ctx.stroke();
  }

  // Gear doors and legs when low; nav lights and a blinking tail strobe.
  if (aircraft.gearDown) {
    ctx.strokeStyle = '#33404f'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-24, 26); ctx.lineTo(-32, 50);
    ctx.moveTo(24, 26); ctx.lineTo(32, 50);
    ctx.moveTo(0, 8); ctx.lineTo(0, 34);
    ctx.stroke();
    ctx.fillStyle = '#222a33';
    ctx.beginPath();
    ctx.arc(-34, 54, 6.5, 0, Math.PI * 2); ctx.arc(34, 54, 6.5, 0, Math.PI * 2); ctx.arc(0, 38, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const lamp = (x, y, colour, r) => {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    halo.addColorStop(0, colour);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();
  };
  lamp(-tipX + 3, tipY, 'rgba(255,70,60,0.9)', 4);
  lamp(tipX - 3, tipY, 'rgba(60,230,120,0.9)', 4);
  if (Math.sin(time * 5.2) > 0.55) lamp(0, 30, 'rgba(255,250,230,0.95)', 3.4);

  ctx.restore();
}

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
