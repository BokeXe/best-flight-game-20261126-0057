// gl-shaders.js — the sunset WebGL programs: a sky dome with sun disc and
// early stars, a glittering sea, one lit-material program for terrain,
// buildings, runway and the aircraft (with emissive windows), and soft
// billboards for clouds and streetlights.

export const SKY_VERTEX = `
attribute vec2 aCorner;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform vec2 uTanHalfFov;
varying vec3 vDir;
void main() {
  vDir = normalize(uFwd + uRight * aCorner.x * uTanHalfFov.x + uUp * aCorner.y * uTanHalfFov.y);
  gl_Position = vec4(aCorner, 0.999, 1.0);
}`;

export const SKY_FRAGMENT = `
precision mediump float;
varying vec3 vDir;
uniform vec3 uSunDir;
float hash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, -0.08, 1.0);
  vec3 horizon = vec3(0.98, 0.62, 0.32);
  vec3 rose = vec3(0.86, 0.42, 0.42);
  vec3 violet = vec3(0.34, 0.24, 0.48);
  vec3 zenith = vec3(0.10, 0.13, 0.32);
  vec3 col = mix(horizon, rose, smoothstep(0.0, 0.16, h));
  col = mix(col, violet, smoothstep(0.12, 0.42, h));
  col = mix(col, zenith, smoothstep(0.38, 0.85, h));
  float sunAmount = max(dot(dir, uSunDir), 0.0);
  float s2 = sunAmount * sunAmount;
  float s4 = s2 * s2;
  float s8 = s4 * s4;
  float p10 = s8 * s2;
  float p20 = p10 * p10;
  float p40 = p20 * p20;
  float p80 = p40 * p40;
  // The broad halo stays modest so a frame flown into the sunset keeps
  // its sky gradient and sea glitter instead of washing out to white.
  col += vec3(1.0, 0.55, 0.22) * p10 * 0.3;
  col += vec3(1.0, 0.72, 0.35) * (p80 * p10) * 0.55;
  col += vec3(1.0, 0.9, 0.65) * smoothstep(0.9997, 0.99992, sunAmount) * 1.05;
  float star = 0.0;
  if (h > 0.25) {
    vec3 cell = floor(dir * 160.0);
    star = step(0.9985, hash(cell)) * smoothstep(0.25, 0.6, h);
  }
  col += vec3(0.8, 0.85, 1.0) * star * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

export const SEA_VERTEX = `
attribute vec3 aPos;
uniform mat4 uMvp;
varying vec3 vWorld;
void main() {
  vWorld = aPos;
  gl_Position = uMvp * vec4(aPos, 1.0);
}`;

export const SEA_FRAGMENT = `
precision mediump float;
varying vec3 vWorld;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform float uTime;
uniform vec3 uFogColor;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec3 viewDir = normalize(uCamPos - vWorld);
  vec2 p = vWorld.xz * 0.045;
  float n1 = noise(p + vec2(uTime * 0.22, uTime * 0.13));
  float n2 = noise(p * 3.1 - vec2(uTime * 0.31, 0.0));
  float n3 = noise(p * 9.7 + vec2(uTime * 0.47, -uTime * 0.29));
  float n = n1 * 0.5 + n2 * 0.32 + n3 * 0.18;
  vec3 normal = normalize(vec3((n - 0.5) * 0.62, 1.0, (n1 - 0.5) * 0.55 + (n3 - 0.5) * 0.16));
  vec3 base = mix(vec3(0.10, 0.16, 0.34), vec3(0.32, 0.20, 0.34), 0.45);
  float fresnelBase = 1.0 - max(viewDir.y, 0.0);
  float fresnel = fresnelBase * fresnelBase;
  base = mix(base, vec3(0.55, 0.30, 0.30), fresnel * 0.55);
  vec3 reflected = reflect(-uSunDir, normal);
  float specBase = max(dot(reflected, viewDir), 0.0);
  float spec2 = specBase * specBase;
  float spec4 = spec2 * spec2;
  float spec8 = spec4 * spec4;
  float spec16 = spec8 * spec8;
  float spec32 = spec16 * spec16;
  float spec64 = spec32 * spec32;
  float spec128 = spec64 * spec64;
  float spec = spec128 * spec8 * spec4;
  float sparkle = step(0.72, n2);
  // A broad glitter path under the sun azimuth: fragments aligned
  // between camera and sun catch a wider, softer gold sheen.
  vec3 toFrag = normalize(vWorld - uCamPos);
  float sunAlign = max(dot(toFrag.xz, normalize(uSunDir.xz)), 0.0);
  float path = sunAlign * sunAlign * sunAlign * sunAlign;
  float glitter = spec * (2.0 + sparkle * 3.0) + path * (0.12 + sparkle * 0.35) * spec4;
  vec3 col = base + vec3(1.0, 0.62, 0.28) * glitter;
  float dist = length(uCamPos - vWorld);
  float fog = 1.0 - exp(-dist * dist * 0.000000048);
  gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
}`;

export const LIT_VERTEX = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute vec2 aUv;
attribute float aEmissive;
uniform mat4 uMvp;
uniform mat4 uModel;
uniform vec3 uSunDir;
varying float vDiffuse;
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vEmissive;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vDiffuse = max(dot(vNormal, uSunDir), 0.0);
  vColor = aColor;
  vUv = aUv;
  vEmissive = aEmissive;
  gl_Position = uMvp * vec4(aPos, 1.0);
}`;

export const LIT_FRAGMENT = `
precision highp float;
varying float vDiffuse;
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vEmissive;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform sampler2D uWindows;
uniform float uUseWindows;
float litHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float litNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(litHash(i), litHash(i + vec2(1, 0)), u.x),
             mix(litHash(i + vec2(0, 1)), litHash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  float diffuse = vDiffuse;
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(uCamPos - vWorld);
  vec3 ambient = vec3(0.56, 0.48, 0.62);
  vec3 sunlight = vec3(1.0, 0.62, 0.34) * diffuse * 1.3;
  vec3 col = vColor * (ambient + sunlight);
  // Two-scale surface grain keeps broad terrain and facade areas from
  // reading as flat colour at HD size, without moving the silhouette.
  float grain = litNoise(vWorld.xz * 0.055) * 0.055 + litNoise(vWorld.xz * 0.42 + vWorld.y * 0.13) * 0.035;
  col *= 0.955 + grain;
  // A tight sun specular and a warm rim separate the built aircraft,
  // metal harbour parts and roof edges from matte ground at a glance.
  vec3 halfVec = normalize(uSunDir + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 56.0) * (0.10 + diffuse * 0.22);
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0) * 0.10;
  col += vec3(1.0, 0.66, 0.34) * spec + vec3(0.95, 0.5, 0.3) * rim;
  if (uUseWindows > 0.5) {
    vec3 win = texture2D(uWindows, vUv).rgb;
    // Let the building's own facade colour carry more of the wall so
    // sand, slate and terracotta towers stay distinct under the window
    // sheet instead of flattening into one dark slab.
    col = col * 0.64 + win * (0.34 + diffuse * 0.18);
    float litPane = smoothstep(0.62, 0.92, max(win.r, win.g * 0.92));
    col += vec3(1.0, 0.62, 0.25) * litPane * 0.16;
  }
  col += vColor * vEmissive;
  col *= 1.04;
  col += (litHash(gl_FragCoord.xy) - 0.5) * 0.012;
  float dist = length(uCamPos - vWorld);
  // Layered dusk haze: a warm near band over the city shelf, then the
  // far fog that melts the hills into the sunset.
  float nearHaze = (1.0 - exp(-dist * 0.00045)) * 0.16;
  col = mix(col, vec3(0.92, 0.6, 0.42), nearHaze);
  float fog = 1.0 - exp(-dist * dist * 0.000000048);
  gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
}`;

export const BILLBOARD_VERTEX = `
attribute vec3 aPos;
attribute vec2 aCorner;
attribute float aSize;
attribute float aAlpha;
uniform mat4 uViewProj;
uniform vec3 uRight;
uniform vec3 uUp;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec3 world = aPos + (uRight * aCorner.x + uUp * aCorner.y) * aSize;
  vUv = aCorner * 0.5 + 0.5;
  vAlpha = aAlpha;
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

export const BILLBOARD_FRAGMENT = `
precision mediump float;
varying vec2 vUv;
varying float vAlpha;
uniform sampler2D uTex;
uniform vec3 uTint;
void main() {
  float a = texture2D(uTex, vUv).a * vAlpha;
  gl_FragColor = vec4(uTint, a);
}`;

export const POINT_VERTEX = `
attribute vec3 aPos;
attribute vec3 aColor;
attribute float aSize;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
varying vec3 vColor;
void main() {
  vColor = aColor;
  float dist = max(length(uCamPos - aPos), 1.0);
  gl_PointSize = clamp(aSize * 900.0 / dist, 1.0, 22.0);
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

export const POINT_FRAGMENT = `
precision mediump float;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.08, length(d));
  gl_FragColor = vec4(vColor, a);
}`;
