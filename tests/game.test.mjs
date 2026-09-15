import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { Game } from "../src/game.ts";
import { Hud } from "../src/hud.ts";
import { disposeObjects } from "../src/models.ts";
import { createDefaultState } from "../src/state.ts";

// Exercise the actual game methods without constructing a WebGL renderer.
function harvestFixture() {
  const game = Object.create(Game.prototype);
  const animal = {
    species: "rabbit",
    kind: "animal",
    alive: true,
    hp: 40,
    group: new THREE.Group(),
  };
  Object.assign(game, {
    state: createDefaultState(),
    target: animal,
    moveTarget: new THREE.Vector3(1, 0, 1),
    attackTimer: 0.5,
    anchor: null,
    view: { showToast() {} },
    updateHud() {},
  });
  return { game, animal };
}

test("automation harvesting a different entity keeps the player target", () => {
  const { game, animal } = harvestFixture();
  const tree = {
    species: "pine",
    kind: "tree",
    hp: 1,
    alive: true,
    group: new THREE.Group(),
  };
  game.harvest(tree, 8, true);
  assert.equal(game.target, animal);
  assert.equal(game.attackTimer, 0.5);
  assert.equal(tree.alive, false);
  assert.ok(game.state.wood >= 2 && game.state.wood <= 3);
});

test("finishing the selected target also clears its stale movement destination", () => {
  const { game, animal } = harvestFixture();
  game.harvest(animal, 40);
  assert.equal(game.target, null);
  assert.equal(game.moveTarget, null);
  assert.equal(game.attackTimer, 0);
});

test("a defeated entity cannot pay out resources again", () => {
  const { game, animal } = harvestFixture();
  game.harvest(animal, 40);
  const meat = game.state.meat;
  game.harvest(animal, 40);
  assert.equal(game.state.meat, meat);
});

test("automation selects the nearest living entity of the requested kind within range", () => {
  const game = Object.create(Game.prototype);
  const entity = (kind, x, alive = true) => {
    const group = new THREE.Group();
    group.position.x = x;
    return { group, kind, alive };
  };
  const tree = entity("tree", 1);
  const deadAnimal = entity("animal", 2, false);
  const nearAnimal = entity("animal", 8);
  game.harvestables = [tree, deadAnimal, entity("animal", 9), nearAnimal];
  const origin = new THREE.Vector3();
  assert.equal(game.nearestHarvestable(origin, "animal", 8), nearAnimal);
  assert.equal(game.nearestHarvestable(origin, "animal", 7), null);
  assert.equal(game.nearestHarvestable(origin, "tree"), tree);
});

test("anchor placement charges gold only after a valid ground click", () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    state: Object.assign(createDefaultState(), { gold: 1000 }),
    anchor: null,
    placingAnchor: false,
    ready: true,
    stunnedUntil: 0,
    view: { showToast() {} },
    updateHud() {},
    saveState() {},
    hud: { infoPanel: { hidden: true } },
    renderer: {
      domElement: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 100,
          height: 100,
        }),
      },
    },
    raycaster: { setFromCamera() {}, intersectObject: () => [] },
    buildAnchorAt(point) {
      this.anchor = point;
    },
  });
  game.startPlacingAnchor();
  assert.equal(game.state.gold, 1000);
  game.onClick({ clientX: 50, clientY: 50 });
  assert.equal(game.state.gold, 1000);
  game.raycaster.intersectObject = () => [
    { point: new THREE.Vector3(10, 0, 12) },
  ];
  game.onClick({ clientX: 50, clientY: 50 });
  assert.equal(game.state.gold, 200);
  assert.deepEqual(game.state.anchorPos, [10, 12]);
  assert.equal(game.placingAnchor, false);
});

test("HUD disables actions during loading and rendering does not award achievements", () => {
  const node = () => ({
    textContent: "",
    disabled: false,
    hidden: true,
    dataset: {},
  });
  const elements = Object.fromEntries(
    [
      "gold",
      "wood",
      "meat",
      "hp",
      "sellBtn",
      "expandBtn",
      "hireBtn",
      "towerBtn",
      "platformBtn",
      "anchorBtn",
      "carrierBtn",
      "prestigeBtn",
      "codexBtn",
      "achievementsBtn",
      "infoPanel",
      "infoPanelTitle",
      "infoPanelBody",
      "offlineBanner",
    ].map((key) => [key, node()]),
  );
  elements.upgradeBtns = Object.fromEntries(
    ["weapon", "armor", "gloves", "boots"].map((key) => [key, node()]),
  );
  const state = Object.assign(createDefaultState(), {
    gold: 1000,
    workerCount: 1,
  });
  const hud = new Hud(elements, () => state);
  hud.render(state, 100, false, false, false);
  assert.equal(elements.hireBtn.disabled, true);
  hud.render(state, 100, false, false, true);
  assert.equal(elements.hireBtn.disabled, false);
  assert.equal(state.gold, 1000);
  assert.deepEqual(state.achievements, {});
});

test("shared model resources are disposed once across clones and material arrays", () => {
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const counts = { geometry: 0, texture: 0, material: 0 };
  for (const [key, resource] of Object.entries({
    geometry,
    texture,
    material,
  })) {
    resource.addEventListener("dispose", () => counts[key]++);
  }
  const mesh = new THREE.Mesh(geometry, [material, material]);
  disposeObjects([mesh, mesh.clone()]);
  assert.deepEqual(counts, { geometry: 1, texture: 1, material: 1 });
});
