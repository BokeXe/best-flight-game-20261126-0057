// missions.js — three sorties over Kestrel Bay: a ring course, a cargo drop
// and a precision landing, each with its own goal, scoring and end state.

import { RUNWAY, TOWN_CENTRE, LIGHTHOUSE, terrainHeightAt } from './terrain.js';

export const MISSION_RINGS = 'rings';
export const MISSION_CARGO = 'cargo';
export const MISSION_LANDING = 'landing';

export function createMission(kind, heights) {
  if (kind === MISSION_CARGO) return createCargoMission(heights);
  if (kind === MISSION_LANDING) return createLandingMission(heights);
  return createRingMission(heights);
}

function createRingMission(heights) {
  const path = [
    [-260, 260, 190], [-700, 60, 240], [-1050, -420, 300], [-620, -980, 260],
    [60, -1280, 320], [640, -820, 240], [1050, -260, 200], [420, 420, 170],
  ];
  const rings = path.map(([x, z, y]) => ({ x, y, z, radius: 46 }));
  return {
    kind: MISSION_RINGS,
    title: 'RING COURSE',
    rings,
    ringIndex: 0,
    target: rings[0],
    bannerTitle: 'MISSION: RING COURSE · EASY',
    bannerText: 'Fly through all 8 rings in order — smooth turns score best',
    finished: false,
    resultLines: [],
  };
}

function createCargoMission(heights) {
  const target = { x: TOWN_CENTRE.x - 160, z: TOWN_CENTRE.z + 240, radius: 90 };
  target.y = terrainHeightAt(heights, target.x, target.z);
  return {
    kind: MISSION_CARGO,
    title: 'CARGO DROP',
    rings: [],
    target,
    crate: null,
    dropped: false,
    bannerTitle: 'MISSION: CARGO DROP · MEDIUM',
    bannerText: 'Press B over the drop zone — lead the target, mind your speed',
    finished: false,
    resultLines: [],
  };
}

function createLandingMission(heights) {
  const touchdown = { x: RUNWAY.x, z: RUNWAY.z0 + 190, radius: 70 };
  touchdown.y = terrainHeightAt(heights, touchdown.x, touchdown.z);
  return {
    kind: MISSION_LANDING,
    title: 'PRECISION LANDING',
    rings: [],
    target: touchdown,
    bannerTitle: 'MISSION: PRECISION LANDING · HARD',
    bannerText: 'Touch down in the marked zone, gently, then stop on the runway',
    finished: false,
    resultLines: [],
    touchdownQuality: null,
  };
}

export function updateMission(mission, aircraft, state, dt, heights) {
  if (mission.finished) return;
  if (mission.kind === MISSION_RINGS) updateRingMission(mission, aircraft, state);
  else if (mission.kind === MISSION_CARGO) updateCargoMission(mission, aircraft, state, dt, heights);
  else updateLandingMission(mission, aircraft, state);
}

function updateRingMission(mission, aircraft, state) {
  const ring = mission.rings[mission.ringIndex];
  if (!ring) return;
  const dist = Math.hypot(aircraft.x - ring.x, aircraft.y - ring.y, aircraft.z - ring.z);
  // Live guidance: distance plus the speed band that earns the clean bonus.
  const inBand = aircraft.speed > 34 && aircraft.speed < 76;
  mission.bannerText = `Ring ${mission.ringIndex + 1} of 8 · ${Math.round(dist)} m · ${inBand ? 'clean speed — hold it' : aircraft.speed <= 34 ? 'too slow for clean bonus' : 'too fast for clean bonus'}`;
  if (dist < ring.radius) {
    const clean = Math.abs(aircraft.roll) < 0.5 && inBand;
    state.score += clean ? 150 : 100;
    state.flash = clean ? 'CLEAN RING +150' : 'RING +100';
    mission.ringIndex++;
    if (mission.ringIndex >= mission.rings.length) {
      // Finish bonuses reward a quick, thrifty, unbent sortie.
      const timeBonus = Math.max(0, Math.round(320 - state.missionTime * 2));
      const fuelBonus = Math.round(aircraft.fuel * 2);
      state.score += timeBonus + fuelBonus;
      finishMission(mission, state, [
        `All 8 rings flown in ${Math.round(state.missionTime)} seconds`,
        `Time bonus +${timeBonus} · fuel bonus +${fuelBonus} · airframe ${Math.round(100 - aircraft.damage)}%`,
      ]);
    } else {
      mission.target = mission.rings[mission.ringIndex];
    }
  }
}

function updateCargoMission(mission, aircraft, state, dt, heights) {
  if (!mission.dropped) {
    // Approach guidance: range, height above the zone, and a speed cue.
    const range = Math.hypot(aircraft.x - mission.target.x, aircraft.z - mission.target.z);
    const heightAbove = Math.round(aircraft.y - mission.target.y);
    const cue = aircraft.speed > 58 ? 'slow down for the drop'
      : range < 160 ? 'over the zone — press B' : 'line up on the beacon';
    mission.bannerText = `Drop zone ${Math.round(range)} m · ${heightAbove} m up · ${cue}`;
  }
  if (state.dropRequested && !mission.dropped) {
    mission.dropped = true;
    mission.crate = {
      x: aircraft.x, y: aircraft.y - 3, z: aircraft.z,
      vx: Math.sin(aircraft.heading) * aircraft.speed,
      vz: -Math.cos(aircraft.heading) * aircraft.speed,
      vy: aircraft.verticalSpeed,
    };
    mission.bannerText = 'Crate away — watch it fall';
    state.flash = 'CARGO AWAY';
  }
  const crate = mission.crate;
  if (!crate) return;
  crate.vy -= 9.81 * dt;
  crate.vx *= 1 - dt * 0.55; // parachute drag
  crate.vz *= 1 - dt * 0.55;
  crate.vx += 2.2 * dt; // a steady sea breeze pushes the crate east
  crate.vy = Math.max(crate.vy, -7);
  crate.x += crate.vx * dt;
  crate.y += crate.vy * dt;
  crate.z += crate.vz * dt;
  const ground = terrainHeightAt(heights, crate.x, crate.z);
  if (crate.y <= ground + 1) {
    const miss = Math.hypot(crate.x - mission.target.x, crate.z - mission.target.z);
    const points = Math.max(0, Math.round(600 - miss * 2.2));
    state.score += points;
    finishMission(mission, state, [
      miss < 25 ? 'Bullseye — the crate landed on the mark' : `Crate down ${Math.round(miss)} m from the centre`,
      `Drop score ${points} · fuel remaining ${Math.round(aircraft.fuel)}%`,
    ]);
    mission.crate = null;
  }
}

function updateLandingMission(mission, aircraft, state) {
  if (!aircraft.onGround) {
    // Approach guidance: range to the mark, sink rate, flap reminder.
    const range = Math.hypot(aircraft.x - mission.target.x, aircraft.z - mission.target.z);
    const sink = Math.round(-aircraft.verticalSpeed * 197);
    const cue = aircraft.flapsDown ? 'flaps set — hold the glide' : 'press F for flaps';
    mission.bannerText = `Touchdown mark ${Math.round(range)} m · sink ${sink} fpm · ${cue}`;
  }
  if (aircraft.onGround && aircraft.speed < 3 && !mission.finished) {
    const miss = Math.hypot(aircraft.x - mission.target.x, aircraft.z - mission.target.z);
    const onStrip = Math.abs(aircraft.x - RUNWAY.x) < RUNWAY.width && aircraft.z > RUNWAY.z0 && aircraft.z < RUNWAY.z1;
    const quality = aircraft.lastTouchdown?.quality ?? 'firm';
    const qualityBonus = quality === 'greased' ? 200 : quality === 'firm' ? 80 : 0;
    let points = onStrip ? Math.max(0, Math.round(700 - miss * 1.6)) + qualityBonus : 60;
    state.score += points;
    finishMission(mission, state, [
      onStrip ? `Stopped ${Math.round(miss)} m from the touchdown mark` : 'Stopped off the runway — the meadow is not a runway',
      quality === 'greased' ? 'Greased it — touchdown bonus +200'
        : quality === 'firm' ? 'Firm arrival +80' : `Hard arrival — airframe damage ${Math.round(aircraft.damage)}%`,
    ]);
  }
}

function finishMission(mission, state, lines) {
  mission.finished = true;
  mission.resultLines = lines;
  mission.bannerTitle = 'MISSION COMPLETE';
  mission.bannerText = lines[0] ?? '';
  state.phase = 'results';
}

export function missionSpawn(kind) {
  if (kind === MISSION_LANDING) {
    // South of the strip, flying north (heading 0) down the runway line.
    return { x: RUNWAY.x, y: 210, z: RUNWAY.z1 + 1500, heading: 0, speed: 52, throttle: 0.45, onGround: false };
  }
  if (kind === MISSION_CARGO) {
    return { x: -900, y: 300, z: 500, heading: 1.1, speed: 58, throttle: 0.6, onGround: false };
  }
  // Parked at the north threshold, lined up for a southbound takeoff roll.
  return { x: RUNWAY.x, y: 16, z: RUNWAY.z0 + 60, heading: Math.PI, speed: 0, throttle: 0, onGround: true };
}

export function isOnRunway(aircraft) {
  return Math.abs(aircraft.x - RUNWAY.x) < RUNWAY.width / 2 + 6
    && aircraft.z > RUNWAY.z0 && aircraft.z < RUNWAY.z1;
}

export { LIGHTHOUSE };
