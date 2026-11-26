// input.js — keyboard and mouse controls: arrows or mouse steer, W/S work
// the throttle, A/D rudder, B drops cargo, C swaps camera, P pauses.

export function createInputState() {
  return {
    keys: new Set(),
    mouseSteer: { x: 0, y: 0, active: false },
    throttleLever: 0,
    dropPressed: false,
    cameraPressed: false,
    pausePressed: false,
    restartPressed: false,
    missionChoice: null,
  };
}

export function attachInputListeners(input, canvas) {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    input.keys.add(key);
    if (key === 'b') input.dropPressed = true;
    if (key === 'c') input.cameraPressed = true;
    if (key === 'p' || key === 'escape') input.pausePressed = true;
    if (key === 'r') input.restartPressed = true;
    if (key === '1') input.missionChoice = 'rings';
    if (key === '2') input.missionChoice = 'cargo';
    if (key === '3') input.missionChoice = 'landing';
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => input.keys.delete(event.key.toLowerCase()));
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseSteer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    input.mouseSteer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    input.mouseSteer.active = true;
  });
  canvas.addEventListener('mouseleave', () => { input.mouseSteer.active = false; });
  canvas.addEventListener('wheel', (event) => {
    input.throttleLever = clamp01(input.throttleLever - Math.sign(event.deltaY) * 0.06);
  }, { passive: true });
  canvas.addEventListener('click', () => { input.mouseSteer.active = true; });
}

export function readControls(input, dt) {
  const keys = input.keys;
  if (keys.has('w')) input.throttleLever = clamp01(input.throttleLever + dt * 0.55);
  if (keys.has('s')) input.throttleLever = clamp01(input.throttleLever - dt * 0.55);
  let pitch = 0, roll = 0, yaw = 0;
  if (keys.has('arrowup')) pitch -= 1;
  if (keys.has('arrowdown')) pitch += 1;
  if (keys.has('arrowleft')) roll -= 1;
  if (keys.has('arrowright')) roll += 1;
  if (keys.has('a')) yaw -= 1;
  if (keys.has('d')) yaw += 1;
  if (input.mouseSteer.active && roll === 0 && pitch === 0) {
    roll = clamp(input.mouseSteer.x * 1.6, -1, 1);
    pitch = clamp(input.mouseSteer.y * 1.4, -1, 1);
  }
  const controls = {
    throttle: input.throttleLever,
    pitch, roll, yaw,
    brake: keys.has(' '),
  };
  return controls;
}

export function consumeOneShotInputs(input) {
  const out = {
    drop: input.dropPressed,
    camera: input.cameraPressed,
    pause: input.pausePressed,
    restart: input.restartPressed,
    mission: input.missionChoice,
  };
  input.dropPressed = false;
  input.cameraPressed = false;
  input.pausePressed = false;
  input.restartPressed = false;
  input.missionChoice = null;
  return out;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
