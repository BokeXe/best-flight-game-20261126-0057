// main.js — Sunwing Courier: boot, the game loop, title and results screens,
// and the render order that ties terrain, aircraft, missions and HUD together.

import { buildIslandHeightfield, buildTownBuildings, buildCloudField, terrainHeightAt } from './terrain.js';
import { createAircraftState, stepFlightModel, refuelIfParked } from './flight-model.js';
import { createChaseCamera, updateChaseCamera, buildViewMatrix } from './camera.js';
import {
  drawSky, drawSea, drawTerrainMesh, drawRunway, drawTownAndLighthouse,
  drawClouds, drawMissionRings, drawCargoTarget, drawFallingCrate,
} from './renderer.js';
import { drawChaseAircraft, drawCockpitPanel } from './aircraft.js';
import { drawHud, drawCockpitInstruments, formatClock } from './hud.js';
import { createMission, updateMission, missionSpawn, isOnRunway, MISSION_CARGO } from './missions.js';
import { createInputState, attachInputListeners, readControls, consumeOneShotInputs } from './input.js';
import { createAudioEngine } from './audio.js';
import { shotSceneFromUrl, applyShotScene, autopilotControls } from './shots.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const state = createGameState(7);
const input = createInputState();
const audio = createAudioEngine();
attachInputListeners(input, canvas);
canvas.addEventListener('click', () => audio.start());

function createGameState(seed) {
  const heights = buildIslandHeightfield(seed);
  return {
    seed,
    heights,
    buildings: buildTownBuildings(seed),
    clouds: buildCloudField(seed),
    aircraft: createAircraftState(missionSpawn('rings')),
    camera: createChaseCamera(),
    missionKind: 'rings',
    mission: createMission('rings', heights),
    phase: 'title', // title | flying | paused | results
    score: 0,
    missionTime: 0,
    time: 0,
    cockpitView: false,
    dropRequested: false,
    flash: '',
    flashUntil: 0,
    shotMode: false,
    view: null,
    lastRingIndex: 0,
  };
}

function startMission(kind) {
  state.missionKind = kind;
  state.mission = createMission(kind, state.heights);
  state.aircraft = createAircraftState(missionSpawn(kind));
  state.camera = createChaseCamera();
  state.score = 0;
  state.missionTime = 0;
  state.phase = 'flying';
  state.flash = '';
  state.lastRingIndex = 0;
  input.throttleLever = state.aircraft.throttle;
  audio.start();
}

function stepGame(dt) {
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
  state.dropRequested = shots.drop;

  const controls = state.shotMode ? autopilotControls(state) : readControls(input, dt);
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
  if (state.mission.ringIndex !== state.lastRingIndex) {
    state.lastRingIndex = state.mission.ringIndex;
    audio.chime('ring');
  }
  if (state.dropRequested && state.missionKind === MISSION_CARGO) audio.chime('drop');
  state.missionTime += dt;
  state.time += dt;
  audio.update(state.aircraft.throttle, state.aircraft.speed, state.aircraft.stalled);
}

function renderGame() {
  const width = canvas.width, height = canvas.height;
  updateChaseCamera(state.camera, state.aircraft, 1 / 60, state.cockpitView);
  const view = buildViewMatrix(state.camera, width, height);
  state.view = view;
  drawSky(ctx, width, height, view);
  drawSea(ctx, width, height, view, state.time);
  drawTerrainMesh(ctx, view, state.heights, state.camera);
  drawRunway(ctx, view, state.heights);
  drawTownAndLighthouse(ctx, view, state.heights, state.buildings, state.time);
  if (state.missionKind === 'rings') {
    drawMissionRings(ctx, view, state.mission.rings, state.mission.ringIndex, state.time);
  }
  if (state.missionKind === MISSION_CARGO) {
    drawCargoTarget(ctx, view, state.mission.target, state.time);
    drawFallingCrate(ctx, view, state.mission.crate);
  }
  drawClouds(ctx, view, state.clouds);
  if (state.cockpitView) {
    drawCockpitPanel(ctx, width, height, state.aircraft, drawCockpitInstruments);
  } else {
    drawChaseAircraft(ctx, width, height, state.aircraft, state.time);
  }
  drawHud(ctx, width, height, state);
  if (state.flash && state.time < state.flashUntil) drawFlashText(width, height);
  if (state.phase === 'title') drawTitleScreen(width, height);
  if (state.phase === 'paused') drawPausedOverlay(width, height);
  if (state.phase === 'results') drawResultsScreen(width, height);
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
  ctx.fillStyle = 'rgba(8,18,32,0.62)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SUNWING COURIER', width / 2, height * 0.2);
  ctx.fillStyle = '#eaf3fb';
  ctx.font = '22px sans-serif';
  ctx.fillText('Island flight missions over Kestrel Bay', width / 2, height * 0.2 + 40);
  const lines = [
    '1  RING COURSE — thread 8 rings around the island',
    '2  CARGO DROP — deliver a crate to the harbour town',
    '3  PRECISION LANDING — stop on the touchdown mark',
    '',
    'W/S throttle · arrows or mouse steer · A/D rudder · Space brake',
    'B drop cargo · C camera · P pause · R restart',
    'Watch fuel and airframe: park on the runway to refuel and repair',
  ];
  ctx.font = '20px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.36 + i * 34));
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press 1, 2 or 3 to fly', width / 2, height * 0.36 + lines.length * 34 + 26);
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
  ctx.fillText(`Score ${state.score} · Time ${formatClock(state.missionTime)}`, width / 2, height * 0.3 + 48);
  ctx.font = '20px sans-serif';
  state.mission.resultLines.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.3 + 92 + i * 32));
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('R fly it again · 1/2/3 choose another mission', width / 2, height * 0.3 + 92 + state.mission.resultLines.length * 32 + 30);
}

// Boot: shot scenes run a fixed number of steps, then hold the frame.
const scene = shotSceneFromUrl(window.location.search);
if (scene) {
  state.seed = scene.seed;
  state.heights = buildIslandHeightfield(scene.seed);
  state.buildings = buildTownBuildings(scene.seed);
  state.clouds = buildCloudField(scene.seed);
  state.mission = createMission(scene.shot === 'cover' ? 'rings' : scene.shot === 'landing' ? 'landing' : 'cargo', state.heights);
  applyShotScene(state, scene);
  for (let i = 0; i < 90; i++) stepGame(1 / 60);
  state.flash = scene.shot === 'cover' ? 'CLEAN RING +150' : '';
  state.flashUntil = state.time + 10;
  renderGame();
} else {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepGame(dt);
    renderGame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
