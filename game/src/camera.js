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
  const boost = aircraft.boostBlend || 0;
  const back = 27 + boost * 5.5, up = 7.6 + boost * 1.3;
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
  const follow = 1 - Math.exp(-dt * 5.2);
  camera.x += (tx - camera.x) * follow;
  camera.y += (ty - camera.y) * follow;
  camera.z += (tz - camera.z) * follow;
  camera.heading = angleLerp(camera.heading, aircraft.heading, 1 - Math.exp(-dt * 6.4));
  camera.pitch += (aircraft.pitch * 0.55 - 0.3 - camera.pitch) * (1 - Math.exp(-dt * 5.2));
  camera.roll += (aircraft.roll * 0.35 - camera.roll) * (1 - Math.exp(-dt * 4.2));
  return camera;
}

function angleLerp(from, to, t) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

// Builds the camera basis once per frame; projectPoint then maps world to
// screen. The view object and its basis vectors are reused across frames.
export function buildViewMatrix(camera, width, height, out = null, fov = 1.02) {
  const view = out || {
    cam: camera,
    fwd: { x: 0, y: 0, z: -1 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    focal: 0, cx: 0, cy: 0, roll: 0,
  };
  const ch = Math.cos(camera.heading), sh = Math.sin(camera.heading);
  const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  // Forward, right and up in world space (heading 0 looks toward -z).
  view.cam = camera;
  view.fwd.x = sh * cp; view.fwd.y = sp; view.fwd.z = -ch * cp;
  view.right.x = ch; view.right.y = 0; view.right.z = sh;
  view.up.x = view.right.y * view.fwd.z - view.right.z * view.fwd.y;
  view.up.y = view.right.z * view.fwd.x - view.right.x * view.fwd.z;
  view.up.z = view.right.x * view.fwd.y - view.right.y * view.fwd.x;
  view.focal = height / (2 * Math.tan(fov / 2));
  view.cx = width / 2;
  view.cy = height / 2;
  view.roll = camera.roll;
  return view;
}

export function projectPoint(view, x, y, z, out = null) {
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
  const point = out || {};
  point.x = view.cx + sx;
  point.y = view.cy + sy;
  point.depth = depth;
  point.scale = view.focal / depth;
  return point;
}
