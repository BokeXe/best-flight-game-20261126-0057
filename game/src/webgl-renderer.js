// webgl-renderer.js — draws the true-3D scene: sky dome, glittering sea,
// terrain mesh, lit-window city, runway, harbour, mission rings and the
// V-wing Sunwing, all depth-tested WebGL with sunset fog. The 2D canvas
// overlay keeps the HUD, so this module only owns the world.

import {
  SKY_VERTEX, SKY_FRAGMENT, SEA_VERTEX, SEA_FRAGMENT,
  LIT_VERTEX, LIT_FRAGMENT, BILLBOARD_VERTEX, BILLBOARD_FRAGMENT,
  POINT_VERTEX, POINT_FRAGMENT,
} from './gl-shaders.js';
import {
  buildTerrainGeometry, buildCityGeometry, buildRunwayGeometry,
  buildHarborGeometry, buildStreetlightPoints, buildCloudBillboards,
  buildStreetsGeometry, buildLandmarksGeometry, buildCarGeometry,
} from './gl-world.js';
import {
  buildAircraftGeometry, buildElevonGeometry, buildExhaustGeometry,
  buildNavLightPoints, buildRingGeometry, buildCrateGeometry, buildBeaconGeometry,
} from './gl-aircraft.js';
import {
  perspectiveMatrix, viewMatrixFromBasis, multiplyMatrices,
  bodyMatrix, facingMatrix, translateMatrix, identityMatrix,
} from './math3d.js';
import { SUNSET, terrainHeightAt, trafficPose } from './terrain.js';

const SUN_DIR = normalize([SUNSET.x, SUNSET.y * 2.2, SUNSET.z]);
const FOG_COLOR = [0.72, 0.44, 0.38];

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function createWebglRenderer(canvas, state) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true })
    || canvas.getContext('experimental-webgl');
  if (!gl) return null;
  gl.getExtension('OES_element_index_uint');
  const renderer = new WebglRenderer(gl, canvas, state);
  return renderer.ready ? renderer : null;
}

class WebglRenderer {
  constructor(gl, canvas, state) {
    this.gl = gl;
    this.canvas = canvas;
    this.ready = false;
    this.sky = compileProgram(gl, SKY_VERTEX, SKY_FRAGMENT);
    this.sea = compileProgram(gl, SEA_VERTEX, SEA_FRAGMENT);
    this.lit = compileProgram(gl, LIT_VERTEX, LIT_FRAGMENT);
    this.billboard = compileProgram(gl, BILLBOARD_VERTEX, BILLBOARD_FRAGMENT);
    this.points = compileProgram(gl, POINT_VERTEX, POINT_FRAGMENT);
    if (!this.sky || !this.sea || !this.lit || !this.billboard || !this.points) return;
    this.terrain = uploadGeometry(gl, buildTerrainGeometry(state.heights));
    this.city = uploadGeometry(gl, buildCityGeometry(state.buildings, state.heights));
    this.streets = uploadGeometry(gl, buildStreetsGeometry(state.heights));
    this.landmarks = uploadGeometry(gl, buildLandmarksGeometry(state.heights));
    this.runway = uploadGeometry(gl, buildRunwayGeometry());
    this.harbor = uploadGeometry(gl, buildHarborGeometry(state.heights));
    // One car mesh per paint colour; traffic poses come from mission time.
    this.carMeshes = new Map();
    for (const car of state.traffic) {
      const key = car.color.join(',');
      if (!this.carMeshes.has(key)) this.carMeshes.set(key, uploadGeometry(gl, buildCarGeometry(car.color)));
    }
    this.trailLeft = [];
    this.trailRight = [];
    this.aircraft = uploadGeometry(gl, buildAircraftGeometry());
    this.elevonLeft = uploadGeometry(gl, buildElevonGeometry(-1));
    this.elevonRight = uploadGeometry(gl, buildElevonGeometry(1));
    this.exhaust = uploadGeometry(gl, buildExhaustGeometry());
    this.ring = uploadGeometry(gl, buildRingGeometry(46));
    this.crate = uploadGeometry(gl, buildCrateGeometry());
    this.beacon = uploadGeometry(gl, buildBeaconGeometry(90));
    this.seaPlane = uploadPositions(gl, new Float32Array([
      -9000, 0, -9000, 9000, 0, -9000, 9000, 0, 9000,
      -9000, 0, -9000, 9000, 0, 9000, -9000, 0, 9000,
    ]));
    this.skyQuad = uploadPositions(gl, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), 2);
    this.streetlights = uploadPoints(gl, buildStreetlightPoints(state.buildings, state.heights));
    this.navLights = uploadPoints(gl, buildNavLightPoints());
    this.clouds = uploadBillboards(gl, buildCloudBillboards(state.clouds));
    this.windowsTexture = makeWindowsTexture(gl);
    this.cloudTexture = makeCloudTexture(gl);
    gl.enable(gl.DEPTH_TEST);
    this.ready = true;
  }

  render(state, view) {
    const gl = this.gl;
    const width = this.canvas.width, height = this.canvas.height;
    gl.viewport(0, 0, width, height);
    const aspect = width / height;
    const fov = 1.02;
    const proj = perspectiveMatrix(fov, aspect, 0.6, 16000);
    const viewMat = viewMatrixFromBasis(view);
    const viewProj = multiplyMatrices(proj, viewMat);
    const camPos = [view.cam.x, view.cam.y, view.cam.z];
    gl.clearColor(FOG_COLOR[0], FOG_COLOR[1], FOG_COLOR[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawSky(view, fov, aspect);
    this.drawSea(viewProj, camPos, state.time);
    this.drawLit(this.terrain, viewProj, identityMatrix(), camPos, false);
    this.drawLit(this.streets, viewProj, identityMatrix(), camPos, false);
    this.drawLit(this.runway, viewProj, identityMatrix(), camPos, false);
    this.drawLit(this.harbor, viewProj, identityMatrix(), camPos, false);
    this.drawLit(this.landmarks, viewProj, identityMatrix(), camPos, false);
    this.drawLit(this.city, viewProj, identityMatrix(), camPos, true);
    this.drawTraffic(state, viewProj, camPos);
    this.drawPoints(this.streetlights, viewProj, camPos, identityMatrix());
    this.drawMissionObjects(state, viewProj, camPos);
    this.drawClouds(view, viewProj);
    this.drawAircraft(state, viewProj, camPos);
  }

  drawSky(view, fov, aspect) {
    const gl = this.gl;
    gl.depthMask(false);
    gl.useProgram(this.sky.program);
    bindPositions(gl, this.sky, this.skyQuad, 'aCorner');
    const tanHalf = Math.tan(fov / 2);
    gl.uniform3f(this.sky.uniforms.uRight, view.right.x, view.right.y, view.right.z);
    gl.uniform3f(this.sky.uniforms.uUp, view.up.x, view.up.y, view.up.z);
    gl.uniform3f(this.sky.uniforms.uFwd, view.fwd.x, view.fwd.y, view.fwd.z);
    gl.uniform2f(this.sky.uniforms.uTanHalfFov, tanHalf * aspect, tanHalf);
    gl.uniform3f(this.sky.uniforms.uSunDir, SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
  }

  drawSea(viewProj, camPos, time) {
    const gl = this.gl;
    gl.useProgram(this.sea.program);
    bindPositions(gl, this.sea, this.seaPlane, 'aPos');
    gl.uniformMatrix4fv(this.sea.uniforms.uMvp, false, viewProj);
    gl.uniform3f(this.sea.uniforms.uCamPos, camPos[0], camPos[1], camPos[2]);
    gl.uniform3f(this.sea.uniforms.uSunDir, SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]);
    gl.uniform1f(this.sea.uniforms.uTime, time);
    gl.uniform3f(this.sea.uniforms.uFogColor, FOG_COLOR[0], FOG_COLOR[1], FOG_COLOR[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawLit(geometry, viewProj, model, camPos, useWindows) {
    const gl = this.gl;
    gl.useProgram(this.lit.program);
    bindLitGeometry(gl, this.lit, geometry);
    gl.uniformMatrix4fv(this.lit.uniforms.uMvp, false, multiplyMatrices(viewProj, model));
    gl.uniformMatrix4fv(this.lit.uniforms.uModel, false, model);
    gl.uniform3f(this.lit.uniforms.uSunDir, SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]);
    gl.uniform3f(this.lit.uniforms.uCamPos, camPos[0], camPos[1], camPos[2]);
    gl.uniform3f(this.lit.uniforms.uFogColor, FOG_COLOR[0], FOG_COLOR[1], FOG_COLOR[2]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.windowsTexture);
    gl.uniform1i(this.lit.uniforms.uWindows, 0);
    gl.uniform1f(this.lit.uniforms.uUseWindows, useWindows ? 1 : 0);
    gl.drawElements(gl.TRIANGLES, geometry.count, gl.UNSIGNED_INT, 0);
  }

  drawTraffic(state, viewProj, camPos) {
    for (const car of state.traffic) {
      const pose = trafficPose(car, state.time, state.heights);
      const mesh = this.carMeshes.get(car.color.join(','));
      this.drawLit(mesh, viewProj, bodyMatrix(pose.x, pose.y, pose.z, pose.heading, 0, 0), camPos, false);
    }
  }

  drawMissionObjects(state, viewProj, camPos) {
    const mission = state.mission;
    if (state.missionKind === 'canyon') {
      mission.rings.forEach((gate, i) => {
        const prev = mission.rings[Math.max(0, i - 1)];
        const next = mission.rings[Math.min(mission.rings.length - 1, i + 1)];
        const model = facingMatrix(gate.x, gate.y, gate.z, next.x - prev.x, next.z - prev.z);
        const scaled = multiplyMatrices(model, bodyMatrix(0, 0, 0, 0, 0, 0, gate.radius / 46));
        this.drawLit(this.ring, viewProj, scaled, camPos, false);
      });
    }
    if (state.missionKind === 'courier') {
      const t = mission.target;
      if (t) {
        const ground = terrainHeightAt(state.heights, t.x, t.z) + 1.2;
        this.drawLit(this.beacon, viewProj, translateMatrix(t.x, ground, t.z), camPos, false);
      }
      if (mission.crate) {
        const c = mission.crate;
        this.drawLit(this.crate, viewProj, bodyMatrix(c.x, c.y, c.z, state.time * 0.4, 0, Math.sin(state.time * 1.3) * 0.12), camPos, false);
      }
    }
    if (state.missionKind === 'rings') {
      mission.rings.forEach((ring, i) => {
        const prev = mission.rings[Math.max(0, i - 1)];
        const next = mission.rings[Math.min(mission.rings.length - 1, i + 1)];
        const model = facingMatrix(ring.x, ring.y, ring.z, next.x - prev.x, next.z - prev.z);
        this.drawLit(this.ring, viewProj, model, camPos, false);
      });
    }
    if (state.missionKind === 'cargo') {
      const t = mission.target;
      const ground = terrainHeightAt(state.heights, t.x, t.z) + 1.2;
      this.drawLit(this.beacon, viewProj, translateMatrix(t.x, ground, t.z), camPos, false);
      if (mission.crate) {
        const c = mission.crate;
        this.drawLit(this.crate, viewProj, bodyMatrix(c.x, c.y, c.z, state.time * 0.4, 0, Math.sin(state.time * 1.3) * 0.12), camPos, false);
      }
    }
  }

  drawClouds(view, viewProj) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(this.billboard.program);
    bindBillboards(gl, this.billboard, this.clouds);
    gl.uniformMatrix4fv(this.billboard.uniforms.uViewProj, false, viewProj);
    gl.uniform3f(this.billboard.uniforms.uRight, view.right.x, view.right.y, view.right.z);
    gl.uniform3f(this.billboard.uniforms.uUp, view.up.x, view.up.y, view.up.z);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cloudTexture);
    gl.uniform1i(this.billboard.uniforms.uTex, 0);
    gl.uniform3f(this.billboard.uniforms.uTint, 0.94, 0.62, 0.58);
    gl.drawArrays(gl.TRIANGLES, 0, this.clouds.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  drawPoints(points, viewProj, camPos, model) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(this.points.program);
    bindPoints(gl, this.points, points);
    gl.uniformMatrix4fv(this.points.uniforms.uViewProj, false, multiplyMatrices(viewProj, model));
    gl.uniform3f(this.points.uniforms.uCamPos, camPos[0], camPos[1], camPos[2]);
    gl.drawArrays(gl.POINTS, 0, points.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  drawAircraft(state, viewProj, camPos) {
    const a = state.aircraft;
    const model = bodyMatrix(a.x, a.y, a.z, a.heading, a.pitch, a.roll);
    this.drawLit(this.aircraft, viewProj, model, camPos, false);
    this.drawLit(this.exhaust, viewProj, model, camPos, false);
    // Elevons hinge at the trailing edge; differential deflection follows
    // roll, common deflection follows pitch, so inputs show on the airframe.
    const hingeY = 0.14, hingeZ = 2.35;
    for (const [geometry, side] of [[this.elevonLeft, -1], [this.elevonRight, 1]]) {
      const deflect = a.pitch * 0.5 + a.roll * side * 0.35;
      const local = multiplyMatrices(
        translateMatrix(0, hingeY, hingeZ),
        bodyMatrix(0, 0, 0, 0, deflect, 0),
      );
      this.drawLit(geometry, viewProj, multiplyMatrices(model, local), camPos, false);
    }
    this.drawPoints(this.navLights, viewProj, camPos, model);
    this.drawVaporTrails(state, viewProj, camPos, model);
  }

  // Wingtip vapor: hard turns at speed shed a fading white trail from
  // each tip, so aggressive flying shows on the airframe and the sky.
  drawVaporTrails(state, viewProj, camPos, model) {
    const a = state.aircraft;
    const shedding = !a.onGround && Math.abs(a.roll) > 0.32 && a.speed > 38;
    const tips = [[-7.6, 0.3, 2.5], [7.6, 0.3, 2.5]];
    const trails = [this.trailLeft, this.trailRight];
    tips.forEach((tip, i) => {
      if (shedding) {
        trails[i].push(applyModel(model, tip));
        if (trails[i].length > 42) trails[i].shift();
      } else if (trails[i].length) {
        trails[i].shift();
      }
    });
    const positions = [], colors = [], sizes = [];
    for (const trail of trails) {
      trail.forEach((p, i) => {
        const fade = i / Math.max(1, trail.length);
        positions.push(p[0], p[1], p[2]);
        colors.push(0.95, 0.9, 0.88);
        sizes.push(1.2 + fade * 2.6);
      });
    }
    if (!positions.length) return;
    const gl = this.gl;
    if (!this.trailBuffer) this.trailBuffer = uploadPoints(gl, {
      positions: new Float32Array(3), colors: new Float32Array(3), sizes: new Float32Array(1),
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuffer.positions.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuffer.colors.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuffer.sizes.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
    this.trailBuffer.count = sizes.length;
    this.drawPoints(this.trailBuffer, viewProj, camPos, identityMatrix());
  }
}

function applyModel(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function compileProgram(gl, vertexSource, fragmentSource) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  const attribs = {};
  const attribCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < attribCount; i++) {
    const info = gl.getActiveAttrib(program, i);
    attribs[info.name] = gl.getAttribLocation(program, info.name);
  }
  return { program, uniforms, attribs };
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function uploadGeometry(gl, geometry) {
  const make = (data) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  };
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
  return {
    positions: make(geometry.positions),
    normals: make(geometry.normals),
    colors: make(geometry.colors),
    uvs: make(geometry.uvs),
    emissive: make(geometry.emissive),
    indices: indexBuffer,
    count: geometry.indices.length,
  };
}

function uploadPositions(gl, data, size = 3) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return { buffer, size, count: data.length / size };
}

function uploadPoints(gl, points) {
  return {
    positions: uploadPositions(gl, points.positions),
    colors: uploadPositions(gl, points.colors),
    sizes: uploadPositions(gl, points.sizes, 1),
    count: points.sizes.length,
  };
}

function uploadBillboards(gl, billboards) {
  return {
    positions: uploadPositions(gl, billboards.positions),
    corners: uploadPositions(gl, billboards.corners, 2),
    sizes: uploadPositions(gl, billboards.sizes, 1),
    alphas: uploadPositions(gl, billboards.alphas, 1),
    count: billboards.sizes.length,
  };
}

function bindPositions(gl, program, entry, name) {
  const location = program.attribs[name];
  if (location === undefined || location < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, entry.buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, entry.size, gl.FLOAT, false, 0, 0);
}

function bindLitGeometry(gl, program, geometry) {
  const bind = (buffer, name, size) => {
    const location = program.attribs[name];
    if (location === undefined || location < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  };
  bind(geometry.positions, 'aPos', 3);
  bind(geometry.normals, 'aNormal', 3);
  bind(geometry.colors, 'aColor', 3);
  bind(geometry.uvs, 'aUv', 2);
  bind(geometry.emissive, 'aEmissive', 1);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry.indices);
}

function bindPoints(gl, program, points) {
  bindPositions(gl, program, points.positions, 'aPos');
  bindPositions(gl, program, points.colors, 'aColor');
  bindPositions(gl, program, points.sizes, 'aSize');
}

function bindBillboards(gl, program, billboards) {
  bindPositions(gl, program, billboards.positions, 'aPos');
  bindPositions(gl, program, billboards.corners, 'aCorner');
  bindPositions(gl, program, billboards.sizes, 'aSize');
  bindPositions(gl, program, billboards.alphas, 'aAlpha');
}

// A repeating window sheet: dark facade cells with warm lit windows in two
// tones, so every building face glows like dusk offices and apartments.
function makeWindowsTexture(gl) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241f2e';
  ctx.fillRect(0, 0, size, size);
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cols = 6, rows = 8;
  const cw = size / cols, ch = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rand();
      if (lit < 0.42) ctx.fillStyle = '#ffb347';
      else if (lit < 0.58) ctx.fillStyle = '#ffe3a3';
      else if (lit < 0.66) ctx.fillStyle = '#7d8aa8';
      else continue;
      ctx.fillRect(c * cw + 4, r * ch + 4, cw - 8, ch - 8);
    }
  }
  return uploadTexture(gl, canvas, true);
}

function makeCloudTexture(gl) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const blobs = [[64, 70, 46], [40, 76, 30], [90, 74, 32], [58, 58, 30], [78, 60, 26]];
  for (const [x, y, r] of blobs) {
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return uploadTexture(gl, canvas, false);
}

function uploadTexture(gl, canvas, repeat) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}
