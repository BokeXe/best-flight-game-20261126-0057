// main.js — Sunwing Courier: boot, the game loop, title and results screens,
// and the render order that ties the sunset coast, aircraft, missions and
// HUD together.

import { buildCoastalHeightfield, buildCityBuildings, buildCloudField, buildTraffic, buildBoats, terrainHeightAt } from './terrain.js';
import { createAircraftState, stepFlightModel, refuelIfParked } from './flight-model.js';
import { createChaseCamera, updateChaseCamera, buildViewMatrix } from './camera.js';
import { createWebglRenderer } from './webgl-renderer.js';
import { drawCockpitPanel } from './aircraft.js';
import { drawHud, drawCockpitInstruments, formatClock } from './hud.js';
import { createMission, updateMission, missionSpawn, isOnRunway, MISSION_CARGO, MISSION_ATTACK } from './missions.js';
import { createInputState, attachInputListeners, readControls, consumeOneShotInputs } from './input.js';
import { createAudioEngine } from './audio.js';
import { shotSceneFromUrl, applyShotScene, autopilotControls } from './shots.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const glCanvas = document.getElementById('gl-canvas');

// The flight model runs on a fixed 120 Hz clock whatever the display
// rate; rendering interpolates between the last two simulation states so
// motion stays smooth without the model ever seeing a ragged dt.
const SIM_STEP = 1 / 120;
const MAX_SIM_STEPS = 14;
const INTERPOLATED_FIELDS = [
  'x', 'y', 'z', 'pitch', 'roll', 'speed', 'verticalSpeed',
  'throttle', 'fuel', 'damage', 'boostCharge', 'boostBlend', 'stallMargin',
];

const state = createGameState(7);
const worldRenderer = createWebglRenderer(glCanvas, state);
const input = createInputState();
const audio = createAudioEngine();
attachInputListeners(input, canvas);
canvas.addEventListener('click', () => audio.start());

function createGameState(seed) {
  const heights = buildCoastalHeightfield(seed);
  const aircraft = createAircraftState(missionSpawn('rings'));
  return {
    seed,
    heights,
    buildings: buildCityBuildings(seed),
    clouds: buildCloudField(seed),
    traffic: buildTraffic(seed),
    boats: buildBoats(seed),
    cash: 0,
    aircraft,
    prevAircraft: { ...aircraft },
    renderAircraft: { ...aircraft },
    accumulator: 0,
    camera: createChaseCamera(),
    missionKind: 'rings',
    mission: createMission('rings', heights),
    phase: 'title', // title | flying | paused | results
    score: 0,
    missionTime: 0,
    time: 0,
    cockpitView: false,
    dropRequested: false,
    fireRequested: false,
    flash: '',
    flashUntil: 0,
    shotMode: false,
    view: null,
    lastRingIndex: 0,
    lastAttackHits: 0,
    lastAttackShots: 0,
  };
}

function startMission(kind) {
  state.missionKind = kind;
  state.mission = createMission(kind, state.heights);
  state.aircraft = createAircraftState(missionSpawn(kind));
  Object.assign(state.prevAircraft, state.aircraft);
  Object.assign(state.renderAircraft, state.aircraft);
  state.accumulator = 0;
  state.camera = createChaseCamera();
  state.score = 0;
  state.cash = 0;
  state.missionTime = 0;
  state.phase = 'flying';
  state.flash = '';
  state.dropRequested = false;
  state.fireRequested = false;
  state.lastRingIndex = 0;
  state.lastAttackHits = 0;
  state.lastAttackShots = 0;
  input.throttleLever = state.aircraft.throttle;
  audio.start();
}

function stepGame(frameDt) {
  const shots = consumeOneShotInputs(input);
  if (state.phase === 'title') {
    if (shots.mission) startMission(shots.mission);
    return;
  }
  if (shots.pause && state.phase === 'flying') state.phase = 'paused';
  else if (shots.pause && state.phase === 'paused') state.phase = 'flying';
  if (shots.restart) { startMission(state.missionKind); return; }
  if (state.phase !== 'flying') return;
  if (shots.camera) state.cockpitView = !state.cockpitView;
  if (shots.drop) {
    state.dropRequested = true;
    state.fireRequested = true;
  }

  const controls = state.shotMode ? autopilotControls(state) : readControls(input, frameDt);
  state.accumulator = Math.min(0.12, state.accumulator + Math.min(frameDt, 0.1));
  let steps = 0;
  while (state.accumulator >= SIM_STEP && steps < MAX_SIM_STEPS) {
    Object.assign(state.prevAircraft, state.aircraft);
    stepSimulation(SIM_STEP, controls);
    state.accumulator -= SIM_STEP;
    steps++;
    if (state.phase !== 'flying') break;
  }
  if (steps >= MAX_SIM_STEPS) state.accumulator = 0; // drop backlog, never spiral
  if (steps > 0) state.dropRequested = false;
  updateRenderAircraft(state.accumulator / SIM_STEP);
}

function stepSimulation(dt, controls) {
  const ground = Math.max(0, terrainHeightAt(state.heights, state.aircraft.x, state.aircraft.z));
  const wasOnGround = state.aircraft.onGround;
  stepFlightModel(state.aircraft, controls, dt, ground);
  if (!wasOnGround && state.aircraft.onGround && !state.aircraft.crashed) audio.thud();
  if (state.aircraft.crashed) {
    state.phase = 'results';
    state.mission.resultLines = ['The Sunwing did not survive that arrival', `Score ${state.score} · time ${formatClock(state.missionTime)}`];
    audio.thud();
    return;
  }
  refuelIfParked(state.aircraft, isOnRunway(state.aircraft));
  updateMission(state.mission, state.aircraft, state, dt, state.heights);
  if (state.mission.ringIndex !== undefined && state.mission.ringIndex !== state.lastRingIndex) {
    state.lastRingIndex = state.mission.ringIndex;
    audio.chime('ring');
  }
  if (state.dropRequested && (state.missionKind === MISSION_CARGO || state.missionKind === 'courier')) audio.chime('drop');
  if (state.missionKind === MISSION_ATTACK) {
    if (state.mission.shots !== state.lastAttackShots) {
      state.lastAttackShots = state.mission.shots;
      audio.chime('fire');
    }
    if (state.mission.hits !== state.lastAttackHits) {
      state.lastAttackHits = state.mission.hits;
      audio.chime('hit');
    }
  }
  state.missionTime += dt;
  state.time += dt;
  audio.update(state.aircraft.throttle, state.aircraft.speed, state.aircraft.stalled, state.aircraft.boostBlend);
}

function updateRenderAircraft(alpha) {
  const prev = state.prevAircraft, current = state.aircraft, render = state.renderAircraft;
  if (alpha >= 1 || state.phase !== 'flying') {
    Object.assign(render, current);
    return;
  }
  Object.assign(render, current);
  for (const field of INTERPOLATED_FIELDS) {
    render[field] = prev[field] + (current[field] - prev[field]) * alpha;
  }
  let headingDiff = (current.heading - prev.heading) % (Math.PI * 2);
  if (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
  if (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
  render.heading = prev.heading + headingDiff * alpha;
}

function renderGame(frameDt = 1 / 60) {
  const width = canvas.width, height = canvas.height;
  const renderAircraft = state.renderAircraft;
  updateChaseCamera(state.camera, renderAircraft, Math.min(frameDt, 0.05), state.cockpitView);
  const fov = 1.02 + (renderAircraft.boostBlend || 0) * 0.17;
  const view = buildViewMatrix(state.camera, width, height, state.view, fov);
  state.view = view;
  ctx.clearRect(0, 0, width, height);
  if (worldRenderer) worldRenderer.render(state, view);
  else drawWebglFallback(width, height);
  if (state.cockpitView) {
    drawCockpitPanel(ctx, width, height, renderAircraft, drawCockpitInstruments);
  }
  drawHud(ctx, width, height, state);
  if (state.flash && state.time < state.flashUntil) drawFlashText(width, height);
  if (state.phase === 'title') drawTitleScreen(width, height);
  if (state.phase === 'paused') drawPausedOverlay(width, height);
  if (state.phase === 'results') drawResultsScreen(width, height);
}

function drawWebglFallback(width, height) {
  ctx.fillStyle = '#241a33';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff4e0';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Sunwing Courier needs WebGL for its 3D coast', width / 2, height / 2);
  ctx.font = '18px sans-serif';
  ctx.fillText('Enable hardware acceleration or try a current desktop browser', width / 2, height / 2 + 36);
}

function drawFlashText(width, height) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#ffd34d';
  ctx.strokeStyle = 'rgba(10,22,38,0.8)';
  ctx.lineWidth = 5;
  ctx.strokeText(state.flash, width / 2, height * 0.42);
  ctx.fillText(state.flash, width / 2, height * 0.42);
}

function drawTitleScreen(width, height) {
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, 'rgba(24,16,44,0.66)');
  shade.addColorStop(0.55, 'rgba(58,26,48,0.58)');
  shade.addColorStop(1, 'rgba(20,12,30,0.72)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SUNWING COURIER', width / 2, height * 0.2);
  ctx.fillStyle = '#fff4e0';
  ctx.font = '22px sans-serif';
  ctx.fillText('Golden-hour courier flights over Solmere Coast', width / 2, height * 0.2 + 40);
  const lines = [
    '1  RING COURSE · EASY — thread 8 rings over the skyline at sunset',
    '2  CARGO DROP · MEDIUM — deliver to the harbour beacon, mind the breeze',
    '3  PRECISION LANDING · HARD — grease it on the coastal touchdown mark',
    '4  AVENUE CANYON · HARD — low gates between the downtown towers',
    '5  COURIER CHAIN · MEDIUM — four district drops against the clock',
    '6  FREE FLIGHT — roam the whole living city, no finish line',
    '7  ATTACK RUN · HARD — dive on harbour markers, fire with B',
    '',
    'W/S or wheel throttle · arrows or mouse steer · A/D rudder',
    'Shift boost · Space brake · F flaps · B drop/fire · C camera · P pause · R restart',
    'Hard turns bleed speed and raise the stall — fly smooth, watch fuel',
    'Park on the runway to refuel and repair a bent airframe',
  ];
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.31 + i * 29));
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press 1–7 to fly', width / 2, height * 0.31 + lines.length * 29 + 24);
}

function drawPausedOverlay(width, height) {
  ctx.fillStyle = 'rgba(8,18,32,0.55)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf3fb';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', width / 2, height / 2);
  ctx.font = '20px sans-serif';
  ctx.fillText('P resume · R restart mission', width / 2, height / 2 + 40);
}

function drawResultsScreen(width, height) {
  ctx.fillStyle = 'rgba(8,18,32,0.66)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(state.aircraft.crashed ? 'SORTIE LOST' : 'MISSION COMPLETE', width / 2, height * 0.3);
  ctx.fillStyle = '#eaf3fb';
  ctx.font = '24px sans-serif';
  ctx.fillText(`Score ${state.score} · Cash $${state.cash} · Time ${formatClock(state.missionTime)}`, width / 2, height * 0.3 + 48);
  ctx.font = '20px sans-serif';
  state.mission.resultLines.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.3 + 92 + i * 32));
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('R fly it again · 1–7 choose another mission', width / 2, height * 0.3 + 92 + state.mission.resultLines.length * 32 + 30);
}

// Boot: shot scenes run a fixed number of steps, then hold the frame.
const scene = shotSceneFromUrl(window.location.search);
if (scene) {
  state.seed = scene.seed;
  state.heights = buildCoastalHeightfield(scene.seed);
  state.buildings = buildCityBuildings(scene.seed);
  state.clouds = buildCloudField(scene.seed);
  state.traffic = buildTraffic(scene.seed);
  state.boats = buildBoats(scene.seed);
  const shotMission = scene.shot === 'cover' ? 'canyon'
    : scene.shot === 'landing' ? 'landing'
      : scene.shot === 'attack' ? MISSION_ATTACK : 'cargo';
  state.missionKind = shotMission;
  state.mission = createMission(shotMission, state.heights);
  applyShotScene(state, scene);
  Object.assign(state.prevAircraft, state.aircraft);
  Object.assign(state.renderAircraft, state.aircraft);
  for (let i = 0; i < 90; i++) stepGame(1 / 60);
  if (scene.shot === 'attack' && state.mission.target) {
    state.mission.pulseUntil = state.time + 1;
    state.mission.pulseX = state.mission.target.x;
    state.mission.pulseY = state.mission.target.y + 8;
    state.mission.pulseZ = state.mission.target.z;
  }
  state.flash = '';
  state.flashUntil = state.time + 10;
  renderGame(1 / 60);
} else {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    stepGame(dt);
    renderGame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
