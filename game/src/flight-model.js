// flight-model.js — how the Sunwing flies: throttle, pitch, roll and yaw with
// speed-dependent authority, a stall that bites at low speed, fuel burn and
// damage from hard arrivals.

export const STALL_SPEED = 26; // m/s indicated
export const MAX_SPEED = 92;
export const BOOST_MAX_SPEED = 118;
export const FUEL_CAPACITY = 100;

export function createAircraftState(spawn) {
  return {
    x: spawn.x, y: spawn.y, z: spawn.z,
    heading: spawn.heading, // radians, 0 = north (-z)
    pitch: 0, roll: 0,
    speed: spawn.speed,
    verticalSpeed: 0,
    throttle: spawn.throttle,
    fuel: FUEL_CAPACITY,
    boostCharge: 1, // 0 spent .. 1 full afterburner
    boostActive: false,
    boostBlend: 0, // smoothed 0..1 for thrust, sound and camera kick
    damage: 0, // 0 pristine .. 100 wrecked
    stalled: false,
    stallMargin: 99,
    flapsDown: false,
    lastTouchdown: null,
    onGround: spawn.onGround === true,
    crashed: false,
    gearDown: spawn.onGround === true,
  };
}

export function stepFlightModel(state, controls, dt, groundHeight) {
  if (state.crashed) return state;
  // Control authority grows smoothly with airspeed: the plane answers at
  // every speed, crisply when fast, gently near the stall.
  const speedFrac = Math.min(1, state.speed / 60);
  const authority = 0.46 + 0.54 * speedFrac * speedFrac * (3 - 2 * speedFrac);
  // Throttle spools toward the lever; an empty tank means no thrust at all.
  // Burn rises steeply with power, so cruising gently stretches the sortie.
  const lever = state.fuel > 0 ? controls.throttle : 0;
  state.throttle += (lever - state.throttle) * Math.min(1, dt * 3.2);
  // Afterburner: a short, loud shove for dives and escapes. Charge drains
  // in about three seconds and refills slowly, so boost is a decision.
  state.boostActive = controls.boost === true && !state.onGround
    && state.fuel > 0 && state.boostCharge > 0.02;
  if (state.boostActive) state.boostCharge = Math.max(0, state.boostCharge - dt * 0.3);
  else state.boostCharge = Math.min(1, state.boostCharge + dt * 0.1);
  state.boostBlend += ((state.boostActive ? 1 : 0) - state.boostBlend) * Math.min(1, dt * 7);
  state.fuel = Math.max(0, state.fuel
    - (0.04 + Math.pow(state.throttle, 1.6) * 0.62 + (state.boostActive ? 0.5 : 0)) * dt);
  state.flapsDown = controls.flaps === true && state.speed < 58;

  // Pitch and roll track the stick with a short lag, then settle: no twitch,
  // no wallow. Wings level themselves when the stick is centred.
  state.pitch += controls.pitch * dt * 1.05 * authority;
  state.pitch = clamp(state.pitch, -0.62, 0.62);
  if (Math.abs(controls.pitch) < 0.05) state.pitch -= state.pitch * dt * 0.5;
  state.roll += controls.roll * dt * 2.05 * authority;
  state.roll = clamp(state.roll, -1.15, 1.15);
  if (Math.abs(controls.roll) < 0.05) state.roll -= state.roll * dt * 1.9;

  // Banked lift turns the aircraft; rudder trims the nose. Hard turns cost
  // energy: induced drag rises with bank, so steep turns bleed speed.
  const turnRate = Math.tan(state.roll) * 9.81 / Math.max(18, state.speed);
  state.heading += (turnRate + controls.yaw * 0.38 * authority) * dt;

  // Energy: thrust accelerates, drag and climbing bleed speed. A bent
  // airframe makes less thrust, so damage is a reason to head home.
  const thrust = (state.throttle * 26 + state.boostBlend * 22) * (1 - state.damage * 0.0022);
  const induced = Math.abs(Math.tan(state.roll)) * state.speed * 0.05;
  const drag = 0.0038 * state.speed * state.speed + induced
    + (controls.brake ? 9 : 0) + (state.flapsDown ? 2.6 : 0);
  const gravityAlongPath = Math.sin(state.pitch) * 9.81;
  state.speed += (thrust - drag - gravityAlongPath) * dt;
  // The boost cap decays softly so cutting the burner never snaps speed.
  const speedCap = MAX_SPEED + state.boostBlend * (BOOST_MAX_SPEED - MAX_SPEED);
  if (state.speed > speedCap) state.speed = Math.max(speedCap, state.speed - dt * 12);
  state.speed = clamp(state.speed, 0, BOOST_MAX_SPEED);

  // The stall: banked flight stalls faster (load factor), flaps buy margin.
  // Below the effective stall speed the nose drops and lift fades.
  const loadFactor = 1 / Math.max(0.45, Math.cos(state.roll));
  const effectiveStall = STALL_SPEED * Math.sqrt(loadFactor) * (state.flapsDown ? 0.82 : 1);
  state.stallMargin = state.speed - effectiveStall;
  state.stalled = state.speed < effectiveStall && !state.onGround;
  let liftFactor = 1;
  if (state.stalled) {
    state.pitch = Math.max(state.pitch - dt * 0.7, -0.45);
    liftFactor = Math.max(0.25, state.speed / effectiveStall);
  }

  const climb = Math.sin(state.pitch) * state.speed * liftFactor;
  // Gentle deterministic gusts near the ground keep landings honest.
  const gust = state.onGround ? 0
    : Math.sin(state.x * 0.011 + state.z * 0.007) * Math.max(0, 1 - (state.y - groundHeight) / 160) * 1.1;
  state.verticalSpeed = climb - (1 - liftFactor) * 14 + gust;
  state.x += Math.sin(state.heading) * Math.cos(state.pitch) * state.speed * dt;
  state.z += -Math.cos(state.heading) * Math.cos(state.pitch) * state.speed * dt;
  state.y += state.verticalSpeed * dt;

  state.gearDown = state.y - groundHeight < 55 || state.onGround;
  resolveGroundContact(state, groundHeight, dt);
  return state;
}

function resolveGroundContact(state, groundHeight, dt) {
  const clearance = state.y - groundHeight;
  if (clearance > 1.2) { state.onGround = false; return; }
  // Touchdown: judge the arrival by sink rate and bank.
  const sink = -state.verticalSpeed;
  const bank = Math.abs(state.roll);
  if (!state.onGround) {
    // Grade every arrival so the pilot learns what a good one feels like.
    const quality = sink <= 2.2 && bank < 0.18 ? 'greased'
      : sink <= 5.5 && bank < 0.45 ? 'firm' : 'hard';
    state.lastTouchdown = { sink, bank, speed: state.speed, quality };
    if (sink > 11 || bank > 0.75 || state.speed > 78) {
      state.crashed = true;
      state.damage = 100;
    } else if (sink > 5.5) {
      state.damage = Math.min(100, state.damage + (sink - 5) * 6);
      if (state.damage >= 100) state.crashed = true;
    }
  }
  state.y = groundHeight + 1.2;
  state.onGround = true;
  state.verticalSpeed = 0;
  if (state.pitch < 0) state.pitch = 0;
  state.roll -= state.roll * Math.min(1, dt * 6);
  // Rolling friction; parked on the runway the tanks refill.
  state.speed = Math.max(0, state.speed - dt * (state.throttle > 0.15 ? 1.5 : 7));
}

export function refuelIfParked(state, onRunway, dt = 1 / 120) {
  if (state.onGround && state.speed < 2 && onRunway) {
    // Refuel and repair take parked time, so diverting home is a real
    // sortie decision rather than an instant reset.
    state.fuel = Math.min(FUEL_CAPACITY, state.fuel + 14 * dt);
    state.damage = Math.max(0, state.damage - 3 * dt);
    return true;
  }
  return false;
}

export function headingDegrees(state) {
  const deg = (state.heading * 180 / Math.PI) % 360;
  return (deg + 360) % 360;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}
