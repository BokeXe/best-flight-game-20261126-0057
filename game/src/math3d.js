// math3d.js — small column-major matrix helpers for the WebGL renderer:
// perspective projection, a look basis from the chase camera, and model
// transforms for the aircraft, rings and cargo crate.

export function perspectiveMatrix(fovRadians, aspect, near, far) {
  const f = 1 / Math.tan(fovRadians / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

// View matrix from the camera basis buildViewMatrix already computes:
// rows are right, up and -forward, translated by the camera position.
export function viewMatrixFromBasis(view) {
  const { cam, right, up, fwd } = view;
  const out = new Float32Array(16);
  out[0] = right.x; out[4] = right.y; out[8] = right.z;
  out[1] = up.x; out[5] = up.y; out[9] = up.z;
  out[2] = -fwd.x; out[6] = -fwd.y; out[10] = -fwd.z;
  out[12] = -(right.x * cam.x + right.y * cam.y + right.z * cam.z);
  out[13] = -(up.x * cam.x + up.y * cam.y + up.z * cam.z);
  out[14] = fwd.x * cam.x + fwd.y * cam.y + fwd.z * cam.z;
  out[15] = 1;
  return out;
}

export function multiplyMatrices(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function rotationY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const out = identityMatrix();
  out[0] = c; out[8] = s; out[2] = -s; out[10] = c;
  return out;
}

function rotationX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const out = identityMatrix();
  out[5] = c; out[9] = -s; out[6] = s; out[10] = c;
  return out;
}

function rotationZ(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const out = identityMatrix();
  out[0] = c; out[4] = -s; out[1] = s; out[5] = c;
  return out;
}

export function identityMatrix() {
  const out = new Float32Array(16);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

// Model matrix for a body whose local forward is -z, matching the flight
// model's heading (0 = north, toward -z), pitch (nose up positive) and
// roll (right wing down positive).
export function bodyMatrix(x, y, z, heading, pitch, roll, scale = 1) {
  let m = rotationY(heading);
  m = multiplyMatrices(m, rotationX(pitch));
  m = multiplyMatrices(m, rotationZ(roll));
  const out = identityMatrix();
  for (let i = 0; i < 16; i++) out[i] = m[i] * scale;
  out[15] = 1;
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

// Ring orientation: local +z faces along the course direction so the torus
// hole looks down the flight path.
export function facingMatrix(x, y, z, dirX, dirZ) {
  const heading = Math.atan2(dirX, dirZ);
  const m = rotationY(heading);
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

export function translateMatrix(x, y, z) {
  const out = identityMatrix();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}
