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
    // The cover frame: a low chase shot down the avenue canyon itself,
    // Sunwing large and clear of the rooftops, one gate ahead over the
    // street, lit towers either side and the sunset sea beyond.
    state.missionKind = 'canyon';
    Object.assign(a, {
      x: 105, y: 104, z: 315, heading: -0.42, pitch: 0.01, roll: -0.22,
      speed: 58, throttle: 0.7, boostCharge: 0.8, boostBlend: 0.3,
      onGround: false, gearDown: false,
    });
    state.missionTime = 42;
    state.score = 300;
    state.cash = 180;
    state.mission.ringIndex = 2;
    state.mission.target = state.mission.rings[2];
    state.mission.bannerText = 'Gate 3 of 9 — in the canyon, bonus live';
  } else if (scene.shot === 'attack') {
    // Attack dive on the third harbour marker: cockpit sight tracking,
    // tracer live, boost burning, cranes and glittering water below.
    state.missionKind = 'attack';
    state.cockpitView = true;
    Object.assign(a, {
      x: -60, y: 185, z: 640, heading: -0.84, pitch: -0.24, roll: -0.18,
      speed: 76, throttle: 0.84, boostCharge: 0.6, boostBlend: 0.75,
      onGround: false, gearDown: false,
    });
    state.missionTime = 47;
    state.score = 1250;
    state.cash = 620;
    state.mission.targetIndex = 2;
    state.mission.target = state.mission.targets[2];
    state.mission.hits = 2;
    state.mission.shots = 3;
  } else if (scene.shot === 'landing') {
    // Final approach from the cockpit: runway large and centred over
    // the lit panel, approach lights leading in, gear and flaps set.
    state.missionKind = 'landing';
    state.cockpitView = true;
    Object.assign(a, { x: 260, y: 34, z: 1245, heading: 0, pitch: -0.04, roll: 0.02, speed: 34, throttle: 0.28, onGround: false, gearDown: true });
    state.missionTime = 92;
    state.score = 0;
  } else if (scene.shot === 'drop') {
    // Cargo away over the harbour: crate under its parachute ahead of the
    // aircraft, drop beacon, cranes and sunset sea below.
    state.missionKind = 'cargo';
    Object.assign(a, { x: 40, y: 190, z: 330, heading: -1.22, pitch: 0.0, roll: -0.18, speed: 50, throttle: 0.5, onGround: false, gearDown: false });
    state.mission.dropped = true;
    // The crate falls just ahead of the Sunwing, inside the chase
    // frame with the harbour beacon below it.
    state.mission.crate = { x: -55, y: 172, z: 272, vx: -8, vy: -7, vz: -3 };
    state.mission.bannerText = 'Crate away — watch it fall';
    state.missionTime = 54;
    state.score = 450;
    state.cash = 225;
  }
  state.time = state.missionTime;
  state.phase = 'flying';
  state.shotMode = true;
  return state;
}

// Gentle scripted flying for shot scenes: ease toward the target with
// a mission-shaped altitude profile. Deterministic in mission state and
// reuses one controls object, so the shot path allocates nothing.
const AUTOPILOT_CONTROLS = { throttle: 0.5, pitch: 0, roll: 0, yaw: 0, brake: false, flaps: false, boost: false };

export function autopilotControls(state) {
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
  const attacking = state.missionKind === 'attack';
  let desiredPitch = 0;
  if (attacking && target) {
    const horizontal = Math.hypot(target.x - a.x, target.z - a.z);
    desiredPitch = Math.max(-0.34, Math.min(0.12, Math.atan2((target.y + 8) - a.y, horizontal)));
  } else if (state.missionKind === 'landing') {
    desiredPitch = -0.035;
  } else if (state.missionKind === 'canyon' && target) {
    desiredPitch = Math.max(-0.1, Math.min(0.1, (target.y - a.y) * 0.003));
  }
  const desiredRoll = Math.max(-0.5, Math.min(0.5, roll * 1.4));
  AUTOPILOT_CONTROLS.throttle = a.throttle;
  AUTOPILOT_CONTROLS.pitch = Math.max(-0.5, Math.min(0.5, (desiredPitch - a.pitch) * 2));
  AUTOPILOT_CONTROLS.roll = Math.max(-0.7, Math.min(0.7, (desiredRoll - a.roll) * 2.2));
  AUTOPILOT_CONTROLS.yaw = 0;
  AUTOPILOT_CONTROLS.brake = false;
  AUTOPILOT_CONTROLS.flaps = state.missionKind === 'landing';
  AUTOPILOT_CONTROLS.boost = attacking || state.missionKind === 'canyon';
  return AUTOPILOT_CONTROLS;
}
