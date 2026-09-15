import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { Effects } from "../src/effects.ts";
import { ModelLibrary, disposeObjects } from "../src/models.ts";
import { Scenery } from "../src/scenery.ts";

test("falling trees restore their transform before respawning", () => {
  const scene = new THREE.Scene();
  const effects = new Effects(scene, { clientWidth: 800, clientHeight: 600 });
  const group = new THREE.Group();
  group.scale.setScalar(4.2);
  group.rotation.y = 1.3;
  const scale = group.scale.clone(),
    rotation = group.rotation.clone();
  effects.fall({ group, kind: "tree" });
  effects.update(0.3, 0.3, new THREE.Camera(), new THREE.Group(), null, false);
  assert.equal(group.visible, true);
  assert.ok(group.rotation.z > 0);
  effects.update(0.4, 0.7, new THREE.Camera(), new THREE.Group(), null, false);
  assert.equal(group.visible, false);
  assert.deepEqual(group.scale, scale);
  assert.equal(group.rotation.equals(rotation), true);
  effects.dispose();
  disposeObjects([scene]);
});

test("movement animation bridges the intervals between fixed game ticks", () => {
  const library = new ModelLibrary();
  const group = new THREE.Group();
  let current = "";
  const action = (name) => ({
    fadeOut() {},
    reset() {
      current = name;
      return this;
    },
    fadeIn() {
      return this;
    },
    play() {},
  });
  library.actors.set(group, {
    mixer: { update() {} },
    actions: new Map(["idle", "walk"].map((name) => [name, action(name)])),
    current: "idle",
    previous: new THREE.Vector3(),
    attackUntil: 0,
    movingUntil: 0,
  });
  group.position.x = 0.2;
  library.update(0.016, 1);
  assert.equal(current, "walk");
  library.update(0.016, 1.016);
  assert.equal(current, "walk");
  library.update(0.2, 1.22);
  assert.equal(current, "idle");
});

test("world decoration is deterministic, uses instancing and provides a raycastable ground", () => {
  const scene = new THREE.Scene(),
    world = new Scenery(scene);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 10, 0),
    new THREE.Vector3(0, -1, 0),
  );
  world.ground.updateMatrixWorld();
  assert.ok(ray.intersectObject(world.ground).length > 0);
  const instanced = world.root.children.filter(
    (child) => child instanceof THREE.InstancedMesh,
  );
  assert.equal(instanced.length, 3);
  assert.ok(instanced.reduce((sum, mesh) => sum + mesh.count, 0) > 1000);
  const otherScene = new THREE.Scene(),
    otherWorld = new Scenery(otherScene);
  assert.deepEqual(
    world.ground.geometry.getAttribute("color").array,
    otherWorld.ground.geometry.getAttribute("color").array,
  );
  world.dispose();
  otherWorld.dispose();
  disposeObjects([scene, otherScene]);
});

test("particle and line resources are included in scene cleanup", () => {
  const geometry = new THREE.BufferGeometry(),
    material = new THREE.PointsMaterial();
  let geometryCount = 0,
    materialCount = 0;
  geometry.addEventListener("dispose", () => geometryCount++);
  material.addEventListener("dispose", () => materialCount++);
  disposeObjects([
    new THREE.Points(geometry, material),
    new THREE.Points(geometry, material),
  ]);
  assert.equal(geometryCount, 1);
  assert.equal(materialCount, 1);
});
