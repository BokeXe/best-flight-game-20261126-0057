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
  buildNavLightPoints, buildRingGeometry, buildCrateGeometry, buildBeaconGeometry, buildTargetGeometry,
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
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false })
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
    // Scratch matrices and poses reused every frame: the render loop
    // allocates no matrices, poses or point arrays after construction.
    this.proj = new Float32Array(16);
    this.viewMat = new Float32Array(16);
    this.viewProj = new Float32Array(16);
    this.mvpScratch = new Float32Array(16);
    this.pointsMvpScratch = new Float32Array(16);
    this.modelScratch = new Float32Array(16);
    this.modelScratch2 = new Float32Array(16);
    this.modelScratch3 = new Float32Array(16);
    this.identity = identityMatrix();
    this.camPos = [0, 0, 0];
    this.carPose = { x: 0, y: 0, z: 0, heading: 0 };
    this.trailLeft = { data: new Float32Array(48 * 3), start: 0, count: 0 };
    this.trailRight = { data: new Float32Array(48 * 3), start: 0, count: 0 };
    this.trailPositions = new Float32Array(96 * 3);
    this.trailColors = new Float32Array(96 * 3);
    this.trailSizes = new Float32Array(96);
    this.trailBuffer = uploadPoints(gl, {
      positions: this.trailPositions, colors: this.trailColors, sizes: this.trailSizes,
    });
    this.attackPositions = new Float32Array(64 * 3);
    this.attackColors = new Float32Array(64 * 3);
    this.attackSizes = new Float32Array(64);
    this.attackBuffer = uploadPoints(gl, {
      positions: this.attackPositions, colors: this.attackColors, sizes: this.attackSizes,
    });
    this.aircraft = uploadGeometry(gl, buildAircraftGeometry());
    this.elevonLeft = uploadGeometry(gl, buildElevonGeometry(-1));
    this.elevonRight = uploadGeometry(gl, buildElevonGeometry(1));
    this.exhaust = uploadGeometry(gl, buildExhaustGeometry());
    this.ring = uploadGeometry(gl, buildRingGeometry(46));
    this.crate = uploadGeometry(gl, buildCrateGeometry());
    this.beacon = uploadGeometry(gl, buildBeaconGeometry(90));
    this.target = uploadGeometry(gl, buildTargetGeometry());
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
    const renderAircraft = state.renderAircraft || state.aircraft;
    const fov = 1.02 + (renderAircraft.boostBlend || 0) * 0.17;
    perspectiveMatrix(fov, aspect, 0.6, 16000, this.proj);
    viewMatrixFromBasis(view, this.viewMat);
    multiplyMatrices(this.proj, this.viewMat, this.viewProj);
    const viewProj = this.viewProj;
    this.camPos[0] = view.cam.x;
    this.camPos[1] = view.cam.y;
    this.camPos[2] = view.cam.z;
    const camPos = this.camPos;
    gl.clearColor(FOG_COLOR[0], FOG_COLOR[1], FOG_COLOR[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Opaque world first, then sea and sky: depth rejects the sea under
    // land and the sky behind the city, cutting full-screen overdraw.
    this.drawLit(this.terrain, viewProj, this.identity, camPos, false);
    this.drawLit(this.streets, viewProj, this.identity, camPos, false);
    this.drawLit(this.runway, viewProj, this.identity, camPos, false);
    this.drawLit(this.harbor, viewProj, this.identity, camPos, false);
    this.drawLit(this.landmarks, viewProj, this.identity, camPos, false);
    this.drawLit(this.city, viewProj, this.identity, camPos, true);
    this.drawSea(viewProj, camPos, state.time);
    this.drawTraffic(state, viewProj, camPos);
    this.drawMissionObjects(state, viewProj, camPos);
    this.drawAircraft(state, viewProj, camPos);
    this.drawSky(view, fov, aspect);
    this.drawPoints(this.streetlights, viewProj, camPos, this.identity);
    this.drawClouds(view, viewProj);
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
    gl.uniformMatrix4fv(this.lit.uniforms.uMvp, false, multiplyMatrices(viewProj, model, this.mvpScratch));
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
    for (let i = 0; i < state.traffic.length; i++) {
      const car = state.traffic[i];
      const pose = trafficPose(car, state.time, state.heights, this.carPose);
      if (!car.colorKey) car.colorKey = car.color.join(',');
      let mesh = this.carMeshes.get(car.colorKey);
      if (!mesh) {
        mesh = uploadGeometry(this.gl, buildCarGeometry(car.color));
        this.carMeshes.set(car.colorKey, mesh);
      }
      bodyMatrix(pose.x, pose.y, pose.z, pose.heading, 0, 0, 1, this.modelScratch);
      this.drawLit(mesh, viewProj, this.modelScratch, camPos, false);
    }
  }

  drawMissionObjects(state, viewProj, camPos) {
    const mission = state.mission;
    if (state.missionKind === 'canyon' || state.missionKind === 'rings') {
      for (let i = 0; i < mission.rings.length; i++) {
        const ring = mission.rings[i];
        const prev = mission.rings[Math.max(0, i - 1)];
        const next = mission.rings[Math.min(mission.rings.length - 1, i + 1)];
        facingMatrix(ring.x, ring.y, ring.z, next.x - prev.x, next.z - prev.z, this.modelScratch);
        if (state.missionKind === 'canyon') {
          bodyMatrix(0, 0, 0, 0, 0, 0, ring.radius / 46, this.modelScratch2);
          multiplyMatrices(this.modelScratch, this.modelScratch2, this.modelScratch3);
          this.drawLit(this.ring, viewProj, this.modelScratch3, camPos, false);
        } else {
          this.drawLit(this.ring, viewProj, this.modelScratch, camPos, false);
        }
      }
    }
    if (state.missionKind === 'courier' || state.missionKind === 'cargo') {
      const t = mission.target;
      if (t) {
        const ground = terrainHeightAt(state.heights, t.x, t.z) + 1.2;
        translateMatrix(t.x, ground, t.z, this.modelScratch);
        this.drawLit(this.beacon, viewProj, this.modelScratch, camPos, false);
      }
      if (mission.crate) {
        const c = mission.crate;
        bodyMatrix(c.x, c.y, c.z, state.time * 0.4, 0, Math.sin(state.time * 1.3) * 0.12, 1, this.modelScratch);
        this.drawLit(this.crate, viewProj, this.modelScratch, camPos, false);
      }
    }
    if (state.missionKind === 'attack') this.drawAttackObjects(state, viewProj, camPos);
  }

  drawAttackObjects(state, viewProj, camPos) {
    const mission = state.mission;
    for (let i = 0; i < mission.targets.length; i++) {
      const target = mission.targets[i];
      const active = i === mission.targetIndex;
      const scale = active ? 1 + Math.sin(state.time * 5) * 0.06 : 0.82;
      bodyMatrix(target.x, target.y - 7.5, target.z, 0, 0, 0, scale, this.modelScratch);
      this.drawLit(this.target, viewProj, this.modelScratch, camPos, false);
      if (active) {
        bodyMatrix(target.x, target.y - 7.4, target.z, 0, 0, 0, 0.38, this.modelScratch);
        this.drawLit(this.beacon, viewProj, this.modelScratch, camPos, false);
      }
    }
    let count = 0;
    const put = (x, y, z, r, g, b, size) => {
      if (count >= 64) return;
      this.attackPositions[count * 3] = x;
      this.attackPositions[count * 3 + 1] = y;
      this.attackPositions[count * 3 + 2] = z;
      this.attackColors[count * 3] = r;
      this.attackColors[count * 3 + 1] = g;
      this.attackColors[count * 3 + 2] = b;
      this.attackSizes[count] = size;
      count++;
    };
    if (state.time < mission.pulseUntil) {
      const a = state.renderAircraft || state.aircraft;
      const noseX = a.x + Math.sin(a.heading) * Math.cos(a.pitch) * 6;
      const noseY = a.y + Math.sin(a.pitch) * 6;
      const noseZ = a.z - Math.cos(a.heading) * Math.cos(a.pitch) * 6;
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        put(
          noseX + (mission.pulseX - noseX) * t,
          noseY + (mission.pulseY - noseY) * t,
          noseZ + (mission.pulseZ - noseZ) * t,
          0.45, 0.95, 1, 2.2 + t * 2.4,
        );
      }
    }
    if (state.time < mission.hitUntil) {
      const age = 0.7 - (mission.hitUntil - state.time);
      const radius = 4 + age * 26;
      for (let i = 0; i < 22; i++) {
        const angle = i * 2.39996;
        put(
          mission.hitX + Math.cos(angle) * radius,
          mission.hitY + Math.sin(i * 1.7) * radius * 0.35,
          mission.hitZ + Math.sin(angle) * radius,
          1, 0.62, 0.2, 3.2,
        );
      }
    }
    if (!count) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.attackBuffer.positions.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.attackPositions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.attackBuffer.colors.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.attackColors);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.attackBuffer.sizes.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.attackSizes);
    this.attackBuffer.count = count;
    this.drawPoints(this.attackBuffer, viewProj, camPos, this.identity);
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
    gl.uniformMatrix4fv(this.points.uniforms.uViewProj, false, multiplyMatrices(viewProj, model, this.pointsMvpScratch));
    gl.uniform3f(this.points.uniforms.uCamPos, camPos[0], camPos[1], camPos[2]);
    gl.drawArrays(gl.POINTS, 0, points.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  drawAircraft(state, viewProj, camPos) {
    if (state.cockpitView) return; // the 2D panel is the cockpit; no fin in the sight picture
    const a = state.renderAircraft || state.aircraft;
    const model = bodyMatrix(a.x, a.y, a.z, a.heading, a.pitch, a.roll, 1, this.modelScratch);
    this.drawLit(this.aircraft, viewProj, model, camPos, false);
    bodyMatrix(0, 0, 0, 0, 0, 0, 1 + (a.boostBlend || 0) * 0.35, this.modelScratch2);
    multiplyMatrices(model, this.modelScratch2, this.modelScratch3);
    this.drawLit(this.exhaust, viewProj, this.modelScratch3, camPos, false);
    // Elevons hinge at the trailing edge; differential deflection follows
    // roll, common deflection follows pitch, so inputs show on the airframe.
    const hingeY = 0.14, hingeZ = 2.35;
    const drawElevon = (geometry, side) => {
      const deflect = a.pitch * 0.5 + a.roll * side * 0.35;
      translateMatrix(0, hingeY, hingeZ, this.modelScratch2);
      bodyMatrix(0, 0, 0, 0, deflect, 0, 1, this.modelScratch3);
      multiplyMatrices(this.modelScratch2, this.modelScratch3, this.mvpScratch);
      multiplyMatrices(model, this.mvpScratch, this.modelScratch3);
      this.drawLit(geometry, viewProj, this.modelScratch3, camPos, false);
    };
    drawElevon(this.elevonLeft, -1);
    drawElevon(this.elevonRight, 1);
    this.drawPoints(this.navLights, viewProj, camPos, model);
    this.drawVaporTrails(state, viewProj, camPos, model);
  }

  // Wingtip vapor: hard turns at speed shed a fading white trail from
  // each tip, so aggressive flying shows on the airframe and the sky.
  // Ring buffers and preallocated point arrays keep this allocation-free.
  drawVaporTrails(state, viewProj, camPos, model) {
    const a = state.renderAircraft || state.aircraft;
    const shedding = !a.onGround && a.speed > 38
      && (Math.abs(a.roll) > 0.32 || (a.boostBlend || 0) > 0.55);
    this.updateTrail(this.trailLeft, model, -7.6, shedding);
    this.updateTrail(this.trailRight, model, 7.6, shedding);
    let count = 0;
    count = this.writeTrail(this.trailLeft, count);
    count = this.writeTrail(this.trailRight, count);
    if (!count) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuffer.positions.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.trailPositions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuffer.colors.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.trailColors);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuffer.sizes.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.trailSizes);
    this.trailBuffer.count = count;
    this.drawPoints(this.trailBuffer, viewProj, camPos, this.identity);
  }

  updateTrail(trail, model, tipX, shedding) {
    if (shedding) {
      const index = (trail.start + trail.count) % 48;
      applyModelInto(trail.data, index * 3, model, tipX, 0.3, 2.5);
      if (trail.count < 48) trail.count++;
      else trail.start = (trail.start + 1) % 48;
    } else if (trail.count > 0) {
      trail.start = (trail.start + 1) % 48;
      trail.count--;
    }
  }

  writeTrail(trail, count) {
    for (let i = 0; i < trail.count; i++) {
      const source = ((trail.start + i) % 48) * 3;
      const fade = i / Math.max(1, trail.count);
      this.trailPositions[count * 3] = trail.data[source];
      this.trailPositions[count * 3 + 1] = trail.data[source + 1];
      this.trailPositions[count * 3 + 2] = trail.data[source + 2];
      this.trailColors[count * 3] = 0.95;
      this.trailColors[count * 3 + 1] = 0.9;
      this.trailColors[count * 3 + 2] = 0.88;
      this.trailSizes[count] = 1.2 + fade * 2.6;
      count++;
    }
    return count;
  }
}

function applyModelInto(out, offset, m, x, y, z) {
  out[offset] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[offset + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[offset + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
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
