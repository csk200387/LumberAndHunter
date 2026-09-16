import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  DAY_CYCLE_SECONDS,
  ForestAtmosphere,
  dayCycleAt,
  forestDepth,
} from "../src/atmosphere.ts";

test("forest darkens with exploration while the starting camp stays warm", () => {
  assert.equal(forestDepth(1, 0), 0);
  assert.equal(forestDepth(1, 8), 0);
  assert.ok(forestDepth(1, 22) > forestDepth(1, 8));
  assert.ok(forestDepth(2, 22) > forestDepth(1, 22));
  assert.ok(forestDepth(2, 42) > forestDepth(2, 22));
  assert.equal(forestDepth(2, 1000), 1);
});

test("unlocking and returning to camp transition smoothly without a brightness jump", () => {
  const scene = new THREE.Scene(),
    atmosphere = new ForestAtmosphere(scene);
  const day = atmosphere.sun.intensity;
  atmosphere.update(1 / 60, 2, 42);
  assert.ok(atmosphere.sun.intensity < day);
  assert.ok(atmosphere.sun.intensity > day - 0.02);
  for (let i = 0; i < 1200; i++) atmosphere.update(1 / 60, 2, 42);
  const deep = atmosphere.sun.intensity;
  assert.ok(deep < 0.86);
  atmosphere.update(1 / 60, 1, 0);
  assert.ok(atmosphere.sun.intensity > deep);
  assert.ok(atmosphere.sun.intensity < deep + 0.02);
});

test("saved progression initializes correctly and deepest forest remains readable", () => {
  const scene = new THREE.Scene(),
    atmosphere = new ForestAtmosphere(scene, 2);
  assert.ok(atmosphere.sun.intensity < 2.6);
  atmosphere.update(100, 2, 42);
  assert.ok(atmosphere.sky.intensity >= 1.15);
  assert.ok(atmosphere.sun.intensity >= 0.85);
  assert.ok(scene.fog.near >= 32 && scene.fog.far >= 92);
  assert.equal(scene.background.equals(scene.fog.color), true);
});

test("time advances through day, dusk, night and dawn before wrapping", () => {
  assert.equal(dayCycleAt(0).stage, "day");
  assert.equal(dayCycleAt(75).stage, "dusk");
  assert.equal(dayCycleAt(100).isNight, true);
  assert.equal(dayCycleAt(105).stage, "night");
  assert.equal(dayCycleAt(150).stage, "dawn");
  assert.equal(dayCycleAt(DAY_CYCLE_SECONDS).stage, "day");
  assert.equal(dayCycleAt(-1).stage, "dawn");
  assert.ok(dayCycleAt(90).darkness > 0 && dayCycleAt(90).darkness < 1);
});

test("night darkens even the starting camp while preserving playable moonlight", () => {
  const scene = new THREE.Scene(),
    atmosphere = new ForestAtmosphere(scene);
  const initialColor = scene.background.clone();
  atmosphere.update(0, 1, 0, 120);
  assert.equal(scene.background.equals(initialColor), false);
  assert.ok(atmosphere.sun.intensity >= 0.32);
  assert.ok(atmosphere.sky.intensity >= 0.58);
  atmosphere.update(0, 1, 0, DAY_CYCLE_SECONDS);
  assert.equal(scene.background.equals(initialColor), true);
});

test("transition speed is independent of render frame rate", () => {
  const a = new ForestAtmosphere(new THREE.Scene());
  const b = new ForestAtmosphere(new THREE.Scene());
  for (let i = 0; i < 30; i++) a.update(1 / 30, 2, 42);
  for (let i = 0; i < 144; i++) b.update(1 / 144, 2, 42);
  assert.ok(Math.abs(a.sun.intensity - b.sun.intensity) < 1e-10);
});
