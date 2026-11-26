// math3d.js — small column-major matrix helpers for the WebGL renderer:
// perspective projection, a look basis from the chase camera, and model
// transforms for the aircraft, rings and cargo crate.

export function perspectiveMatrix(fovRadians, aspect, near, far, out = new Float32Array(16)) {
  const f = 1 / Math.tan(fovRadians / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

// View matrix from the camera basis buildViewMatrix already computes:
// rows are right, up and -forward, translated by the camera position.
export function viewMatrixFromBasis(view, out = new Float32Array(16)) {
  const { cam, right, up, fwd } = view;
  out.fill(0);
  out[0] = right.x; out[4] = right.y; out[8] = right.z;
  out[1] = up.x; out[5] = up.y; out[9] = up.z;
  out[2] = -fwd.x; out[6] = -fwd.y; out[10] = -fwd.z;
  out[12] = -(right.x * cam.x + right.y * cam.y + right.z * cam.z);
  out[13] = -(up.x * cam.x + up.y * cam.y + up.z * cam.z);
  out[14] = fwd.x * cam.x + fwd.y * cam.y + fwd.z * cam.z;
  out[15] = 1;
  return out;
}

// Callers pass a scratch matrix for per-frame work; out must not alias a or b.
export function multiplyMatrices(a, b, out = new Float32Array(16)) {
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4], b1 = b[col * 4 + 1], b2 = b[col * 4 + 2], b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

function rotationY(angle, out = new Float32Array(16)) {
  const c = Math.cos(angle), s = Math.sin(angle);
  identityMatrix(out);
  out[0] = c; out[8] = s; out[2] = -s; out[10] = c;
  return out;
}

export function identityMatrix(out = new Float32Array(16)) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

// Model matrix for a body whose local forward is -z, matching the flight
// model's heading (0 = north, toward -z), pitch (nose up positive) and
// roll (right wing down positive). The Y*X*Z rotation is written directly
// into the caller's matrix so the render loop allocates nothing here.
export function bodyMatrix(x, y, z, heading, pitch, roll, scale = 1, out = new Float32Array(16)) {
  const cy = Math.cos(heading), sy = Math.sin(heading);
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  const cz = Math.cos(roll), sz = Math.sin(roll);
  out.fill(0);
  out[0] = (cy * cz + sy * sx * sz) * scale;
  out[1] = cx * sz * scale;
  out[2] = (-sy * cz + cy * sx * sz) * scale;
  out[4] = (-cy * sz + sy * sx * cz) * scale;
  out[5] = cx * cz * scale;
  out[6] = (sy * sz + cy * sx * cz) * scale;
  out[8] = sy * cx * scale;
  out[9] = -sx * scale;
  out[10] = cy * cx * scale;
  out[12] = x; out[13] = y; out[14] = z;
  out[15] = 1;
  return out;
}

// Ring orientation: local +z faces along the course direction so the torus
// hole looks down the flight path.
export function facingMatrix(x, y, z, dirX, dirZ, out = new Float32Array(16)) {
  const heading = Math.atan2(dirX, dirZ);
  rotationY(heading, out);
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function translateMatrix(x, y, z, out = new Float32Array(16)) {
  identityMatrix(out);
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}
