import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ForestAtmosphere, forestDepth } from "../src/atmosphere.ts";

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

test("elapsed time does not darken an unexplored starting camp", () => {
  const scene = new THREE.Scene(),
    atmosphere = new ForestAtmosphere(scene);
  const initialColor = scene.background.clone();
  atmosphere.update(3600, 1, 0);
  assert.equal(scene.background.equals(initialColor), true);
  assert.equal(atmosphere.sun.intensity, 2.6);
});

test("transition speed is independent of render frame rate", () => {
  const a = new ForestAtmosphere(new THREE.Scene());
  const b = new ForestAtmosphere(new THREE.Scene());
  for (let i = 0; i < 30; i++) a.update(1 / 30, 2, 42);
  for (let i = 0; i < 144; i++) b.update(1 / 144, 2, 42);
  assert.ok(Math.abs(a.sun.intensity - b.sun.intensity) < 1e-10);
});
