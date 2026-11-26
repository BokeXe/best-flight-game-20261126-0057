// flight-model.js — how the Sunwing flies: throttle, pitch, roll and yaw with
// speed-dependent authority, a stall that bites at low speed, fuel burn and
// damage from hard arrivals.

export const STALL_SPEED = 26; // m/s indicated
export const MAX_SPEED = 92;
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
    damage: 0, // 0 pristine .. 100 wrecked
    stalled: false,
    onGround: spawn.onGround === true,
    crashed: false,
    gearDown: spawn.onGround === true,
  };
}

export function stepFlightModel(state, controls, dt, groundHeight) {
  if (state.crashed) return state;
  const authority = Math.min(1, Math.max(0.25, state.speed / 55));
  // Throttle spools toward the lever; an empty tank means no thrust at all.
  const lever = state.fuel > 0 ? controls.throttle : 0;
  state.throttle += (lever - state.throttle) * Math.min(1, dt * 2.2);
  state.fuel = Math.max(0, state.fuel - state.throttle * dt * 0.55);

  // Pitch and roll answer at every speed, but gently when slow.
  state.pitch += controls.pitch * dt * 0.85 * authority;
  state.pitch = clamp(state.pitch, -0.62, 0.62);
  state.roll += controls.roll * dt * 1.7 * authority;
  state.roll = clamp(state.roll, -1.15, 1.15);
  if (Math.abs(controls.roll) < 0.05) state.roll -= state.roll * dt * 1.4; // wings level themselves

  // Banked lift turns the aircraft; rudder trims the nose.
  const turnRate = Math.tan(state.roll) * 9.81 / Math.max(18, state.speed);
  state.heading += (turnRate + controls.yaw * 0.35 * authority) * dt;

  // Energy: thrust accelerates, drag and climbing bleed speed.
  const thrust = state.throttle * 26;
  const drag = 0.0038 * state.speed * state.speed + (controls.brake ? 9 : 0);
  const gravityAlongPath = Math.sin(state.pitch) * 9.81;
  state.speed += (thrust - drag - gravityAlongPath) * dt;
  state.speed = clamp(state.speed, 0, MAX_SPEED);

  // The stall: below flying speed the nose drops and lift fades.
  state.stalled = state.speed < STALL_SPEED && !state.onGround;
  let liftFactor = 1;
  if (state.stalled) {
    state.pitch = Math.max(state.pitch - dt * 0.7, -0.45);
    liftFactor = Math.max(0.25, state.speed / STALL_SPEED);
  }

  const climb = Math.sin(state.pitch) * state.speed * liftFactor;
  state.verticalSpeed = climb - (1 - liftFactor) * 14;
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

export function refuelIfParked(state, onRunway) {
  if (state.onGround && state.speed < 2 && onRunway) {
    state.fuel = Math.min(FUEL_CAPACITY, state.fuel + 22);
    state.damage = Math.max(0, state.damage - 6);
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
