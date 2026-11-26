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
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}
void main() {
  float h = clamp(vDir.y, -0.08, 1.0);
  vec3 horizon = vec3(0.98, 0.62, 0.32);
  vec3 rose = vec3(0.86, 0.42, 0.42);
  vec3 violet = vec3(0.34, 0.24, 0.48);
  vec3 zenith = vec3(0.10, 0.13, 0.32);
  vec3 col = mix(horizon, rose, smoothstep(0.0, 0.16, h));
  col = mix(col, violet, smoothstep(0.12, 0.42, h));
  col = mix(col, zenith, smoothstep(0.38, 0.85, h));
  float sunAmount = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.55, 0.22) * pow(sunAmount, 10.0) * 0.45;
  col += vec3(1.0, 0.72, 0.35) * pow(sunAmount, 90.0) * 0.8;
  col += vec3(1.0, 0.9, 0.65) * smoothstep(0.99955, 0.99985, sunAmount) * 1.25;
  vec3 cell = floor(normalize(vDir) * 160.0);
  float star = step(0.9985, hash(cell)) * smoothstep(0.25, 0.6, h);
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
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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
  float n = noise(p + vec2(uTime * 0.22, uTime * 0.13)) * 0.6
          + noise(p * 3.1 - vec2(uTime * 0.31, 0.0)) * 0.4;
  vec3 normal = normalize(vec3((n - 0.5) * 0.55, 1.0, (noise(p * 1.7 + 7.0) - 0.5) * 0.55));
  vec3 base = mix(vec3(0.10, 0.16, 0.34), vec3(0.32, 0.20, 0.34), 0.45);
  float fresnel = pow(1.0 - max(viewDir.y, 0.0), 2.0);
  base = mix(base, vec3(0.55, 0.30, 0.30), fresnel * 0.55);
  vec3 reflected = reflect(-normalize(uSunDir), normal);
  float spec = pow(max(dot(reflected, viewDir), 0.0), 140.0);
  float sparkle = step(0.72, noise(vWorld.xz * 0.6 + uTime * 1.4));
  vec3 col = base + vec3(1.0, 0.62, 0.28) * spec * (1.6 + sparkle * 2.4);
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
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vWorld;
varying float vEmissive;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vColor = aColor;
  vUv = aUv;
  vEmissive = aEmissive;
  gl_Position = uMvp * vec4(aPos, 1.0);
}`;

export const LIT_FRAGMENT = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vUv;
varying vec3 vWorld;
varying float vEmissive;
uniform vec3 uSunDir;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform sampler2D uWindows;
uniform float uUseWindows;
void main() {
  vec3 n = normalize(vNormal);
  float diffuse = max(dot(n, normalize(uSunDir)), 0.0);
  vec3 ambient = vec3(0.52, 0.46, 0.58);
  vec3 sunlight = vec3(1.0, 0.62, 0.34) * diffuse * 1.1;
  vec3 col = vColor * (ambient + sunlight);
  if (uUseWindows > 0.5) {
    vec3 win = texture2D(uWindows, vUv).rgb;
    col = col * 0.55 + win * (0.35 + diffuse * 0.2);
  }
  col += vColor * vEmissive;
  float dist = length(uCamPos - vWorld);
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
