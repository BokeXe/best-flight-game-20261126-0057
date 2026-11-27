// missions.js — seven golden-hour sorties over Solmere Coast: a skyline
// ring course, a harbour cargo drop, a precision landing at the coastal
// runway, an avenue canyon, a four-stop courier chain, free flight and a
// harbour attack run, each with its own goal, scoring and end state.

import { RUNWAY, HARBOR, LIGHTHOUSE, STADIUM, districtAt, terrainHeightAt } from './terrain.js';

export const MISSION_RINGS = 'rings';
export const MISSION_CARGO = 'cargo';
export const MISSION_LANDING = 'landing';
export const MISSION_CANYON = 'canyon';
export const MISSION_COURIER = 'courier';
export const MISSION_FREE = 'free';
export const MISSION_ATTACK = 'attack';

export function createMission(kind, heights) {
  if (kind === MISSION_CARGO) return createCargoMission(heights);
  if (kind === MISSION_LANDING) return createLandingMission(heights);
  if (kind === MISSION_CANYON) return createCanyonMission(heights);
  if (kind === MISSION_COURIER) return createCourierMission(heights);
  if (kind === MISSION_FREE) return createFreeMission();
  if (kind === MISSION_ATTACK) return createAttackMission(heights);
  return createRingMission(heights);
}

function createRingMission(heights) {
  // North from the coastal runway, across the skyline to the sunset sea,
  // around the harbour headland and back over the lit avenues.
  const path = [
    [260, 430, 175], [-80, -260, 225], [-430, -560, 255], [-520, -940, 285],
    [-140, -1160, 305], [260, -880, 265], [520, -380, 225], [390, 170, 185],
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
  const target = { x: HARBOR.x + 30, z: HARBOR.z + 10, radius: 90 };
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

// Avenue canyon: gates strung down the downtown avenue between the
// towers. Staying under the altitude ceiling earns the street bonus;
// climbing out of the canyon still counts the gate, at plain value.
function createCanyonMission(heights) {
  const avenueX = 55;
  const gates = [];
  for (let z = 420; z >= -780; z -= 150) {
    gates.push({ x: avenueX, y: terrainHeightAt(heights, avenueX, z) + 58, z, radius: 34 });
  }
  return {
    kind: MISSION_CANYON,
    title: 'AVENUE CANYON',
    rings: gates,
    ringIndex: 0,
    target: gates[0],
    ceiling: 95,
    bannerTitle: 'MISSION: AVENUE CANYON · HARD',
    bannerText: 'Thread the downtown gates low — stay under the ceiling for street bonuses',
    finished: false,
    resultLines: [],
  };
}

// Courier chain: four drops across the districts against the clock.
// Each accurate drop pays cash; finishing inside the limit pays the
// route bonus on top.
function createCourierMission(heights) {
  const stops = [
    { name: 'HARBOR', x: HARBOR.x + 30, z: HARBOR.z + 10 },
    { name: 'STADIUM', x: STADIUM.x, z: STADIUM.z },
    { name: 'BEACHFRONT', x: -240, z: 640 },
    { name: 'DOWNTOWN', x: 150, z: -300 },
  ].map((s) => ({ ...s, radius: 85, y: terrainHeightAt(heights, s.x, s.z) }));
  return {
    kind: MISSION_COURIER,
    title: 'COURIER CHAIN',
    rings: [],
    stops,
    stopIndex: 0,
    target: stops[0],
    crate: null,
    dropped: false,
    timeLimit: 300,
    bannerTitle: 'MISSION: COURIER CHAIN · MEDIUM',
    bannerText: 'Four drops, four districts — beat the clock for the route bonus',
    finished: false,
    resultLines: [],
  };
}

// Free flight: no finish line, the city is the mission. The banner
// names the district under the wing as the pilot roams.
function createFreeMission() {
  return {
    kind: MISSION_FREE,
    title: 'FREE FLIGHT',
    rings: [],
    target: null,
    bannerTitle: 'FREE FLIGHT · SOLMERE COAST',
    bannerText: 'Explore the city — districts, harbour, stadium and shore',
    finished: false,
    resultLines: [],
  };
}

// Attack run: six training markers around the harbour range. The pilot
// dives on each marker, centres it in the reticle and fires a training
// pulse with B; fast, steep, well-aimed passes pay best. Flying recklessly
// low strains the airframe, so the run rewards commitment with control.
function createAttackMission(heights) {
  const targets = [
    { name: 'QUAY MARKER', x: -360, z: 80 },
    { name: 'CRANE MARKER', x: -210, z: 230 },
    { name: 'BAY MARKER', x: -455, z: 285 },
    { name: 'PIER MARKER', x: -170, z: 20 },
    { name: 'SOUTH MARKER', x: -320, z: 430 },
    { name: 'WEST MARKER', x: -560, z: 90 },
  ].map((t) => ({ ...t, radius: 95, y: Math.max(0, terrainHeightAt(heights, t.x, t.z)) + 8 }));
  return {
    kind: MISSION_ATTACK,
    title: 'ATTACK RUN',
    rings: [],
    targets,
    targetIndex: 0,
    target: targets[0],
    hits: 0,
    shots: 0,
    lock: 0,
    alignment: 0,
    range: 0,
    inReticle: false,
    attackWindow: false,
    cooldown: 0,
    pulseUntil: -1,
    pulseX: 0, pulseY: 0, pulseZ: 0,
    hitUntil: -1,
    hitX: 0, hitY: 0, hitZ: 0,
    lowWarning: false,
    bannerTitle: 'MISSION: ATTACK RUN · HARD',
    bannerText: 'Dive on the harbour markers — centre the reticle, press B to fire',
    finished: false,
    resultLines: [],
  };
}

export function updateMission(mission, aircraft, state, dt, heights) {
  if (mission.finished) return;
  if (mission.kind === MISSION_RINGS) updateRingMission(mission, aircraft, state);
  else if (mission.kind === MISSION_CARGO) updateCargoMission(mission, aircraft, state, dt, heights);
  else if (mission.kind === MISSION_CANYON) updateCanyonMission(mission, aircraft, state, heights);
  else if (mission.kind === MISSION_COURIER) updateCourierMission(mission, aircraft, state, dt, heights);
  else if (mission.kind === MISSION_FREE) updateFreeMission(mission, aircraft, state);
  else if (mission.kind === MISSION_ATTACK) updateAttackMission(mission, aircraft, state, dt, heights);
  else updateLandingMission(mission, aircraft, state);
}

function updateAttackMission(mission, aircraft, state, dt, heights) {
  const target = mission.targets[mission.targetIndex];
  if (!target) return;
  mission.cooldown = Math.max(0, mission.cooldown - dt);
  const ground = Math.max(0, terrainHeightAt(heights, aircraft.x, aircraft.z));
  const agl = aircraft.y - ground;
  // Reckless-low feedback: skimming the range at speed strains the
  // airframe until the pilot climbs or slows down.
  mission.lowWarning = !aircraft.onGround && agl < 10 && aircraft.speed > 48;
  if (mission.lowWarning) {
    aircraft.damage = Math.min(100, aircraft.damage + dt * 7);
    if (aircraft.damage >= 100) aircraft.crashed = true;
    state.flash = 'TOO LOW — AIRFRAME STRAIN';
    state.flashUntil = state.time + 0.25;
  }
  const dx = target.x - aircraft.x;
  const dy = target.y + 8 - aircraft.y;
  const dz = target.z - aircraft.z;
  const dist = Math.hypot(dx, dy, dz);
  const cosPitch = Math.cos(aircraft.pitch);
  const fx = Math.sin(aircraft.heading) * cosPitch;
  const fy = Math.sin(aircraft.pitch);
  const fz = -Math.cos(aircraft.heading) * cosPitch;
  const alignment = dist > 0 ? (fx * dx + fy * dy + fz * dz) / dist : 0;
  const rangeFactor = dist < 1000 ? 1 : Math.max(0, 1 - (dist - 1000) / 700);
  mission.range = dist;
  mission.alignment = alignment;
  mission.lock = Math.max(0, Math.min(1, (alignment - 0.82) / 0.16)) * rangeFactor * (dist < 55 ? 0.35 : 1);
  mission.inReticle = alignment > 0.962 && dist >= 55 && dist <= 980;
  mission.attackWindow = agl >= 14 && agl <= 190 && aircraft.speed >= 34;
  const cue = mission.inReticle
    ? (mission.attackWindow ? 'LOCK — press B' : agl > 190 ? 'LOCK — dive into the window' : agl < 14 ? 'LOCK — pull up' : 'LOCK — build speed')
    : mission.lock > 0.35 ? 'tracking — centre the reticle' : 'line up the dive';
  mission.bannerText = `${target.name} ${mission.targetIndex + 1} of ${mission.targets.length} · ${Math.round(dist)} m · ${cue} · hits ${mission.hits}/${mission.shots}`;
  if (!state.fireRequested) return;
  state.fireRequested = false;
  if (mission.cooldown > 0) return;
  mission.shots++;
  mission.cooldown = 0.38;
  mission.pulseUntil = state.time + 0.16;
  mission.pulseX = target.x;
  mission.pulseY = target.y + 8;
  mission.pulseZ = target.z;
  if (mission.inReticle && mission.attackWindow) {
    const points = Math.round(260 + mission.lock * 140
      + Math.max(0, aircraft.speed - 40) * 2
      + Math.max(0, -aircraft.verticalSpeed) * 4);
    state.score += points;
    state.cash += Math.round(points / 2);
    mission.hits++;
    mission.hitUntil = state.time + 0.7;
    mission.hitX = target.x;
    mission.hitY = target.y + 8;
    mission.hitZ = target.z;
    state.flash = `TARGET HIT +${points}`;
    state.flashUntil = state.time + 1.1;
    mission.targetIndex++;
    if (mission.targetIndex >= mission.targets.length) {
      const accuracy = mission.shots > 0 ? mission.hits / mission.shots : 0;
      const bonus = Math.round(accuracy * 300 + Math.max(0, 300 - state.missionTime));
      state.score += bonus;
      state.cash += Math.round(bonus / 2);
      finishMission(mission, state, [
        `All ${mission.targets.length} range markers hit in ${Math.round(state.missionTime)} seconds`,
        `Accuracy ${Math.round(accuracy * 100)}% · bonus +${bonus} · airframe ${Math.round(100 - aircraft.damage)}%`,
      ]);
    } else {
      mission.target = mission.targets[mission.targetIndex];
    }
  } else {
    state.flash = !mission.inReticle ? 'PULSE MISSED'
      : agl > 190 ? 'TOO HIGH — DIVE'
        : agl < 14 ? 'TOO LOW — PULL UP' : 'TOO SLOW — BOOST';
    state.flashUntil = state.time + 0.9;
  }
}

function updateCanyonMission(mission, aircraft, state, heights) {
  const gate = mission.rings[mission.ringIndex];
  if (!gate) return;
  const dist = Math.hypot(aircraft.x - gate.x, aircraft.y - gate.y, aircraft.z - gate.z);
  const aboveGround = Math.round(aircraft.y - terrainHeightAt(heights, aircraft.x, aircraft.z));
  const low = aboveGround <= mission.ceiling;
  mission.bannerText = `Gate ${mission.ringIndex + 1} of ${mission.rings.length} · ${Math.round(dist)} m · ${low ? 'in the canyon — bonus live' : 'above the ceiling — dive for the bonus'}`;
  if (dist < gate.radius) {
    const points = low ? 200 : 100;
    state.score += points;
    state.cash += low ? 120 : 50;
    state.flash = low ? 'STREET BONUS +200' : 'GATE +100';
    mission.ringIndex++;
    if (mission.ringIndex >= mission.rings.length) {
      const timeBonus = Math.max(0, Math.round(360 - state.missionTime * 2));
      state.score += timeBonus;
      state.cash += 300;
      finishMission(mission, state, [
        `All ${mission.rings.length} canyon gates flown in ${Math.round(state.missionTime)} seconds`,
        `Time bonus +${timeBonus} · cash earned $${state.cash} · airframe ${Math.round(100 - aircraft.damage)}%`,
      ]);
    } else {
      mission.target = mission.rings[mission.ringIndex];
    }
  }
}

function updateCourierMission(mission, aircraft, state, dt, heights) {
  const stop = mission.stops[mission.stopIndex];
  if (!stop) return;
  const left = Math.max(0, Math.round(mission.timeLimit - state.missionTime));
  if (!mission.dropped) {
    const range = Math.hypot(aircraft.x - stop.x, aircraft.z - stop.z);
    const cue = aircraft.speed > 58 ? 'slow down for the drop'
      : range < 160 ? 'over the zone — press B' : 'line up on the beacon';
    mission.bannerText = `${stop.name} drop ${mission.stopIndex + 1} of 4 · ${Math.round(range)} m · ${left}s left · ${cue}`;
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
  crate.vx *= 1 - dt * 0.55;
  crate.vz *= 1 - dt * 0.55;
  crate.vx += 2.2 * dt;
  crate.vy = Math.max(crate.vy, -7);
  crate.x += crate.vx * dt;
  crate.y += crate.vy * dt;
  crate.z += crate.vz * dt;
  const ground = terrainHeightAt(heights, crate.x, crate.z);
  if (crate.y <= ground + 1) {
    const miss = Math.hypot(crate.x - stop.x, crate.z - stop.z);
    const points = Math.max(0, Math.round(450 - miss * 2));
    state.score += points;
    state.cash += Math.round(points / 2);
    state.flash = miss < 25 ? 'BULLSEYE DROP' : `DROP +${points}`;
    mission.crate = null;
    mission.dropped = false;
    mission.stopIndex++;
    if (mission.stopIndex >= mission.stops.length) {
      const routeBonus = state.missionTime <= mission.timeLimit
        ? Math.round((mission.timeLimit - state.missionTime) * 2) : 0;
      state.score += routeBonus;
      state.cash += routeBonus;
      finishMission(mission, state, [
        `All four districts served in ${Math.round(state.missionTime)} seconds`,
        `Route bonus +${routeBonus} · cash earned $${state.cash} · fuel ${Math.round(aircraft.fuel)}%`,
      ]);
    } else {
      mission.target = mission.stops[mission.stopIndex];
    }
  }
}

function updateFreeMission(mission, aircraft, state) {
  const district = districtAt(aircraft.x, aircraft.z);
  if (mission.district !== district) {
    mission.district = district;
    state.flash = district;
  }
  mission.bannerText = `Now over ${district} · the whole coast is yours`;
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
    state.cash += clean ? 75 : 40;
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
    state.cash += Math.round(points / 2);
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
      onStrip ? `Stopped ${Math.round(miss)} m from the touchdown mark` : 'Stopped off the runway — the apron is not a runway',
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
    // South of the strip, flying north (heading 0) down the runway line,
    // city and beach on the left, approach lights ahead.
    return { x: RUNWAY.x, y: 210, z: RUNWAY.z1 + 1500, heading: 0, speed: 52, throttle: 0.45, onGround: false };
  }
  if (kind === MISSION_CARGO || kind === MISSION_COURIER) {
    // Inland east of the city, turning west toward the harbour beacon.
    return { x: 760, y: 300, z: 560, heading: -1.15, speed: 58, throttle: 0.6, onGround: false };
  }
  if (kind === MISSION_CANYON) {
    // South of downtown, lined up on the avenue for the first gate.
    return { x: 55, y: 130, z: 720, heading: 0, speed: 55, throttle: 0.55, onGround: false };
  }
  if (kind === MISSION_ATTACK) {
    // Southeast of the harbour range, already diving toward the first
    // marker with speed on and the burner ready.
    return { x: 240, y: 285, z: 760, heading: -0.78, speed: 62, throttle: 0.68, onGround: false };
  }
  if (kind === MISSION_FREE) {
    // Airborne over the beachfront, the whole city spread ahead.
    return { x: -120, y: 260, z: 900, heading: 0, speed: 55, throttle: 0.55, onGround: false };
  }
  // Parked at the south threshold, lined up for a northbound takeoff roll
  // toward the skyline and the sunset sea.
  return { x: RUNWAY.x, y: 14, z: RUNWAY.z1 - 60, heading: 0, speed: 0, throttle: 0, onGround: true };
}

export function isOnRunway(aircraft) {
  return Math.abs(aircraft.x - RUNWAY.x) < RUNWAY.width / 2 + 6
    && aircraft.z > RUNWAY.z0 && aircraft.z < RUNWAY.z1;
}

export { LIGHTHOUSE };
