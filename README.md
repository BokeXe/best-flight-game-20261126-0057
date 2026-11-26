# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/BokeXe/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/BokeXe/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sunwing Courier** — an original 3D chase-view flight game over the island
of Kestrel Bay, built for make.fun's "Make the best flight game" bounty
($500 in USDC, top 50).

Fly the Sunwing over a seeded island heightfield — coast, meadows, wooded
ridges, a harbour town with lit windows and a lighthouse — through three
missions: thread eight target rings in order, drop a cargo crate onto the
town drop zone, or stop on the runway touchdown mark. The flight model
rewards throttle and turn discipline: speed-dependent control authority, a
stall that drops the nose, fuel that burns with throttle (park on the
runway to refuel and repair), and airframe damage from hard arrivals.

The HUD keeps altitude, speed, heading and vertical speed in front of the
pilot at all times, with a compass tape, artificial horizon, fuel /
throttle / airframe gauges, warning lights, a minimap and an off-screen
target arrow. Press C for the cockpit view with big round instruments.

## Play

Serve `game/` with any static HTTP server and open `index.html` in desktop
Chrome — no network requests, no build step.

- **1 / 2 / 3** choose a mission
- **W / S** throttle, **arrows or mouse** steer, **A / D** rudder,
  **Space** brake
- **B** drop cargo, **C** camera, **P** pause, **R** restart

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `dossier.json` with the kit's
`buildDossier`; both runs write identical bytes.

## Layout

- `game/src/flight-model.js` — throttle, stall, fuel and damage
- `game/src/terrain.js` — the Kestrel Bay heightfield, town and clouds
- `game/src/renderer.js` — sky, sea, terrain mesh, runway, rings
- `game/src/aircraft.js` — the Sunwing and its cockpit panel
- `game/src/hud.js` — instruments, minimap, warnings
- `game/src/missions.js` — ring course, cargo drop, precision landing
- `game/src/camera.js`, `input.js`, `audio.js`, `shots.js`, `main.js`
