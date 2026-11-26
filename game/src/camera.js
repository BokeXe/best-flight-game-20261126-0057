// camera.js — a chase camera that trails the Sunwing without fighting the
// pilot, plus the projection every renderer shares.

export function createChaseCamera() {
  return { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, primed: false };
}

export function updateChaseCamera(camera, aircraft, dt, cockpitView) {
  if (cockpitView) {
    camera.x = aircraft.x + Math.sin(aircraft.heading) * 1.3;
    camera.y = aircraft.y + 2.1;
    camera.z = aircraft.z - Math.cos(aircraft.heading) * 1.3;
    camera.heading = aircraft.heading;
    camera.pitch = aircraft.pitch;
    camera.roll = aircraft.roll;
    camera.primed = true;
    return camera;
  }
  const back = 27, up = 7.6;
  const tx = aircraft.x - Math.sin(aircraft.heading) * back;
  const tz = aircraft.z + Math.cos(aircraft.heading) * back;
  const ty = aircraft.y + up;
  if (!camera.primed) {
    camera.x = tx; camera.y = ty; camera.z = tz;
    camera.heading = aircraft.heading;
    camera.pitch = aircraft.pitch * 0.55 - 0.3;
    camera.roll = aircraft.roll * 0.35;
    camera.primed = true;
  }
  const follow = 1 - Math.exp(-dt * 4.2);
  camera.x += (tx - camera.x) * follow;
  camera.y += (ty - camera.y) * follow;
  camera.z += (tz - camera.z) * follow;
  camera.heading = angleLerp(camera.heading, aircraft.heading, 1 - Math.exp(-dt * 5.5));
  camera.pitch += (aircraft.pitch * 0.55 - 0.3 - camera.pitch) * (1 - Math.exp(-dt * 4.5));
  camera.roll += (aircraft.roll * 0.35 - camera.roll) * (1 - Math.exp(-dt * 3.5));
  return camera;
}

function angleLerp(from, to, t) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

// Builds the camera basis once per frame; projectPoint then maps world to screen.
export function buildViewMatrix(camera, width, height) {
  const ch = Math.cos(camera.heading), sh = Math.sin(camera.heading);
  const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  // Forward, right and up in world space (heading 0 looks toward -z).
  const fwd = { x: sh * cp, y: sp, z: -ch * cp };
  const right = { x: ch, y: 0, z: sh };
  const up = {
    x: right.y * fwd.z - right.z * fwd.y,
    y: right.z * fwd.x - right.x * fwd.z,
    z: right.x * fwd.y - right.y * fwd.x,
  };
  const focal = height * 0.95;
  return { cam: camera, fwd, right, up, focal, cx: width / 2, cy: height / 2, roll: camera.roll };
}

export function projectPoint(view, x, y, z) {
  const dx = x - view.cam.x, dy = y - view.cam.y, dz = z - view.cam.z;
  const depth = dx * view.fwd.x + dy * view.fwd.y + dz * view.fwd.z;
  if (depth < 1.5) return null;
  let sx = (dx * view.right.x + dy * view.right.y + dz * view.right.z) * view.focal / depth;
  let sy = -(dx * view.up.x + dy * view.up.y + dz * view.up.z) * view.focal / depth;
  if (view.roll) {
    const cr = Math.cos(-view.roll), sr = Math.sin(-view.roll);
    const rx = sx * cr - sy * sr, ry = sx * sr + sy * cr;
    sx = rx; sy = ry;
  }
  return { x: view.cx + sx, y: view.cy + sy, depth, scale: view.focal / depth };
}
