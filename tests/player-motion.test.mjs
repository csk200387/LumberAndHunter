import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PlayerMotion } from "../src/player-motion.ts";

test("a paused movement tick does not teleport the player", () => {
  const player = new THREE.Group(),
    motion = new PlayerMotion();
  motion.reset(player);
  assert.equal(motion.move(player, new THREE.Vector3(10, 0, 0), 0, 4.5), false);
  assert.deepEqual(player.position.toArray(), [0, 0, 0]);
});

test("rendered movement progresses between fixed ticks without changing the simulation position", () => {
  const player = new THREE.Group(),
    motion = new PlayerMotion();
  motion.reset(player);
  motion.capture(player);
  motion.move(player, new THREE.Vector3(0, 0, 10), 0.05, 4.5);
  const simulated = player.position.clone(),
    samples = [];
  for (const alpha of [0.2, 0.5, 0.8]) {
    motion.interpolate(player, alpha);
    samples.push(player.position.z);
    motion.restore(player);
    assert.deepEqual(player.position, simulated);
  }
  assert.ok(
    samples[0] > 0 && samples[0] < samples[1] && samples[1] < samples[2],
  );
  assert.ok(samples[2] < simulated.z);
});

test("player accelerates, turns gradually and arrives without overshooting", () => {
  const player = new THREE.Group(),
    motion = new PlayerMotion();
  motion.reset(player);
  const target = new THREE.Vector3(5, 0, 0);
  motion.move(player, target, 0.05, 4.5);
  assert.ok(player.rotation.y > 0 && player.rotation.y < Math.PI / 2);
  assert.ok(motion.speed > 0 && motion.speed < 4.5);
  let arrived = false;
  for (let i = 0; i < 200; i++) {
    arrived = motion.move(player, target, 0.05, 4.5);
    assert.ok(player.position.x <= 5);
    if (arrived) break;
  }
  assert.equal(arrived, true);
  assert.ok(player.position.distanceTo(target) < 0.001);
  assert.equal(motion.speed, 0);
});

test("pursuing a resource stops at attack range", () => {
  const player = new THREE.Group(),
    motion = new PlayerMotion();
  motion.reset(player);
  const target = new THREE.Vector3(0, 0, 10);
  for (let i = 0; i < 200; i++)
    if (motion.move(player, target, 0.05, 4.5, 2)) break;
  assert.ok(Math.abs(player.position.distanceTo(target) - 2) < 0.001);
  assert.equal(motion.speed, 0);
});

test("teleport resets the interpolated pose instead of drawing a sweep across the map", () => {
  const player = new THREE.Group(),
    motion = new PlayerMotion();
  motion.reset(player);
  motion.move(player, new THREE.Vector3(8, 0, 8), 0.05, 4.5);
  player.position.set(1, 0, 3);
  motion.reset(player);
  motion.interpolate(player, 0.5);
  assert.deepEqual(player.position.toArray(), [1, 0, 3]);
  motion.restore(player);
  assert.equal(motion.speed, 0);
});
