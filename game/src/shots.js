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
    // Chase view banking over the downtown avenue canyon: traffic
    // streaming below, towers either side, the next gate centred ahead,
    // sunset sea beyond the skyline, instruments lit around the edges.
    state.missionKind = 'canyon';
    Object.assign(a, { x: 55, y: 84, z: 645, heading: 0.04, pitch: 0.0, roll: -0.25, speed: 56, throttle: 0.62, onGround: false, gearDown: false });
    state.missionTime = 38;
    state.score = 600;
    state.cash = 360;
    state.mission.ringIndex = 0;
    state.mission.target = state.mission.rings[0];
    state.mission.bannerText = 'Gate 1 of 9 — in the canyon, bonus live';
  } else if (scene.shot === 'panel') {
    // Cockpit view west over the city toward the harbour and sunset sea,
    // instruments lit against the dusk.
    state.missionKind = 'cargo';
    state.cockpitView = true;
    Object.assign(a, { x: 260, y: 170, z: 240, heading: -1.35, pitch: -0.3, roll: 0.06, speed: 55, throttle: 0.55, onGround: false, gearDown: false });
    state.missionTime = 63;
    state.score = 0;
  } else if (scene.shot === 'landing') {
    // Final approach: coastal runway centred ahead, beach and city to the
    // left, gear down, gentle descent.
    state.missionKind = 'landing';
    Object.assign(a, { x: 260, y: 52, z: 1400, heading: 0, pitch: -0.05, roll: 0.02, speed: 38, throttle: 0.3, onGround: false, gearDown: true });
    state.missionTime = 88;
    state.score = 0;
  } else if (scene.shot === 'drop') {
    // Cargo away over the harbour: crate under its parachute ahead of the
    // aircraft, drop beacon and cranes below.
    state.missionKind = 'cargo';
    Object.assign(a, { x: 300, y: 260, z: 220, heading: -1.35, pitch: 0.01, roll: -0.1, speed: 48, throttle: 0.5, onGround: false, gearDown: false });
    state.mission.dropped = true;
    state.mission.crate = { x: 180, y: 245, z: 190, vx: -5, vy: -7, vz: -2 };
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
  const targetAltitude = state.missionKind === 'landing' ? 62
    : state.missionKind === 'canyon' ? (target?.y ?? 96) : 240;
  const pitch = Math.max(-0.12, Math.min(0.12, (targetAltitude - a.y) * 0.002));
  return { throttle: a.throttle, pitch, roll, yaw: 0, brake: false, flaps: state.missionKind === 'landing' };
}
