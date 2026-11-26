// shots.js — deterministic screenshot scenes for the hand-in. Each scene
// places the aircraft in a fixed state and flies a scripted autopilot for a
// fixed number of steps, so the captured frame is real gameplay, identical
// on every run with the same seed.

export function shotSceneFromUrl(search) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = Number(params.get('seed') ?? 7) || 7;
  return { shot, seed };
}

export function applyShotScene(state, scene) {
  const a = state.aircraft;
  if (scene.shot === 'cover') {
    // Chase view over the bay: town and coast ahead, first ring in frame.
    state.missionKind = 'rings';
    Object.assign(a, { x: -420, y: 250, z: 560, heading: -0.35, pitch: 0.02, roll: -0.22, speed: 62, throttle: 0.62, onGround: false, gearDown: false });
    state.missionTime = 41;
    state.score = 150;
    state.mission.ringIndex = 1;
    state.mission.target = state.mission.rings[1];
    state.mission.bannerText = 'Ring 2 of 8 — follow the arrow';
  } else if (scene.shot === 'panel') {
    // Cockpit view low over the harbour town, instruments lit.
    state.missionKind = 'cargo';
    state.cockpitView = true;
    Object.assign(a, { x: 700, y: 175, z: 320, heading: 1.15, pitch: -0.09, roll: 0.08, speed: 55, throttle: 0.55, onGround: false, gearDown: false });
    state.missionTime = 63;
    state.score = 0;
  } else if (scene.shot === 'landing') {
    // Final approach: runway centred ahead, gear down, gentle descent.
    state.missionKind = 'landing';
    Object.assign(a, { x: -262, y: 66, z: 1540, heading: 0, pitch: -0.05, roll: 0.02, speed: 38, throttle: 0.3, onGround: false, gearDown: true });
    state.missionTime = 88;
    state.score = 0;
  } else if (scene.shot === 'drop') {
    // Cargo away: crate under its parachute above the drop zone.
    state.missionKind = 'cargo';
    Object.assign(a, { x: 880, y: 230, z: 160, heading: 1.25, pitch: 0.01, roll: -0.1, speed: 48, throttle: 0.5, onGround: false, gearDown: false });
    state.mission.dropped = true;
    state.mission.crate = { x: 985, y: 208, z: 82, vx: 6, vy: -7, vz: -4 };
    state.mission.bannerText = 'Crate away — watch it fall';
    state.missionTime = 52;
    state.score = 0;
  }
  state.phase = 'flying';
  state.shotMode = true;
  return state;
}

export function autopilotControls(state) {
  // Gentle scripted flying for shot scenes: hold altitude, ease toward target.
  const a = state.aircraft;
  const target = state.mission.target;
  let roll = 0;
  if (target) {
    const bearing = Math.atan2(target.x - a.x, -(target.z - a.z));
    let diff = bearing - a.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    roll = Math.max(-0.4, Math.min(0.4, diff * 0.8));
  }
  const targetAltitude = state.missionKind === 'landing' ? 62 : 240;
  const pitch = Math.max(-0.12, Math.min(0.12, (targetAltitude - a.y) * 0.002));
  return { throttle: a.throttle, pitch, roll, yaw: 0, brake: false };
}
