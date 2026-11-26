# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/BokeXe/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/BokeXe/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sunwing Courier** — an original 3D chase-view flight game over Solmere
Coast, a coastal city at golden hour, built for make.fun's "Make the best
flight game" bounty ($500 in USDC, top 50).

Fly the Sunwing over a seeded coastal heightfield — sunset sea, beach
promenade, a lit skyline with streetlights and moving traffic, a working
harbour and a coastal runway — through seven missions: thread eight target
rings over the skyline, drop cargo onto the harbour beacon, stop on the
runway touchdown mark, thread the downtown Avenue Canyon gates, run a
four-stop courier chain, roam in Free Flight, or dive on harbour training
markers in Attack Run. The flight model rewards throttle and turn
discipline: speed-dependent control authority, a stall that drops the
nose, fuel that burns with throttle (park on the runway to refuel and
repair), airframe damage from hard arrivals, and a Shift afterburner with
a limited charge for dives and escapes. The simulation runs on a fixed
120 Hz clock with render interpolation, so control response stays steady
whatever the display rate.

The HUD keeps altitude, speed, heading and vertical speed in front of the
pilot at all times, with a compass tape, artificial horizon, fuel /
throttle / boost / airframe gauges, warning lights, a minimap and an
off-screen target arrow. Attack Run adds a nose-tracking reticle with a
lock arc, range readout and hit feedback. Press C for the cockpit view
with big round instruments.

## Play

Serve `game/` with any static HTTP server and open `index.html` in desktop
Chrome — no network requests, no build step.

- **1–7** choose a mission (7 is Attack Run)
- **W / S** throttle, **arrows or mouse** steer, **A / D** rudder,
  **Space** brake, **Shift** afterburner boost
- **B** drop cargo / fire the training pulse, **C** camera, **P** pause,
  **R** restart

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `dossier.json` with the kit's
`buildDossier`; both runs write identical bytes.

## Layout

- `game/src/flight-model.js` — throttle, stall, fuel, boost and damage
- `game/src/terrain.js` — the Solmere Coast heightfield, skyline, traffic
- `game/src/webgl-renderer.js` — merged-geometry WebGL scene, scratch buffers
- `game/src/gl-world.js`, `gl-aircraft.js`, `gl-shaders.js` — geometry/shaders
- `game/src/aircraft.js` — the Sunwing cockpit panel
- `game/src/hud.js` — instruments, minimap, attack reticle, warnings
- `game/src/missions.js` — rings, cargo, landing, canyon, courier, attack
- `game/src/camera.js`, `input.js`, `audio.js`, `shots.js`, `main.js`
