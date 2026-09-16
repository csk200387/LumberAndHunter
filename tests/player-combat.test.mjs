import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { Game } from "../src/game.ts";
import { ModelLibrary } from "../src/models.ts";
import { PlayerMotion } from "../src/player-motion.ts";
import { createDefaultState } from "../src/state.ts";
import { ATTACK_RANGE, TICK } from "../src/balance.ts";
import { attackInterval } from "../src/economy.ts";

function fixture(distance = ATTACK_RANGE) {
  const game = Object.create(Game.prototype);
  const target = {
    group: new THREE.Group(),
    species: "pine",
    kind: "tree",
    alive: true,
    hp: 1000,
  };
  target.group.position.z = distance;
  let strikes = 0;
  Object.assign(game, {
    ready: true,
    state: createDefaultState(),
    player: new THREE.Group(),
    playerMotion: new PlayerMotion(),
    target,
    moveTarget: target.group.position.clone(),
    attackCooldown: 0,
    stunnedUntil: 0,
    placingAnchor: false,
    harvestables: [target],
    models: { strike: () => strikes++ },
    view: { showToast() {} },
    updateHud() {},
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
    raycaster: {
      setFromCamera() {},
      intersectObjects: () => [{ object: game.harvestables[0].group }],
    },
  });
  game.playerMotion.reset(game.player);
  return {
    game,
    target,
    strikes: () => strikes,
    click: () => game.onClick({ clientX: 50, clientY: 50 }),
  };
}

test("first attack lands on the first tick when already within range", () => {
  const { game, target, strikes } = fixture();
  game.tickPlayer(TICK, 0);
  assert.equal(strikes(), 1);
  assert.equal(target.hp, 990);
  assert.equal(game.attackCooldown, attackInterval(game.state));
});

test("crossing into attack range hits in the same movement tick", () => {
  const { game, target, strikes } = fixture(ATTACK_RANGE + 0.02);
  game.tickPlayer(TICK, 0);
  assert.ok(
    game.player.position.distanceTo(target.group.position) <= ATTACK_RANGE,
  );
  assert.equal(strikes(), 1);
  assert.equal(game.playerMotion.speed, 0);
});

test("out-of-range and stunned players cannot attack", () => {
  const { game, target, strikes } = fixture(10);
  game.tickPlayer(TICK, 0);
  assert.equal(strikes(), 0);
  target.group.position.copy(game.player.position);
  game.stunnedUntil = 1000;
  game.tickPlayer(TICK, 500);
  assert.equal(strikes(), 0);
  game.tickPlayer(TICK, 1000);
  assert.equal(strikes(), 1);
});

test("subsequent hits preserve both base and upgraded glove intervals", () => {
  for (const gloves of [0, 20]) {
    const { game, strikes } = fixture();
    game.state.upgrades.gloves = gloves;
    game.tickPlayer(TICK, 0);
    const ticks = Math.round(attackInterval(game.state) / TICK);
    for (let i = 1; i < ticks; i++) game.tickPlayer(TICK, i * 50);
    assert.equal(strikes(), 1);
    game.tickPlayer(TICK, ticks * 50);
    assert.equal(strikes(), 2);
  }
});

test("recovery continues between targets instead of restarting upon arrival", () => {
  const { game, target, strikes } = fixture();
  game.tickPlayer(TICK, 0);
  game.target = null;
  game.moveTarget = new THREE.Vector3(0, 0, 10);
  for (let i = 0; i < 20; i++) game.tickPlayer(TICK, i * 50);
  target.group.position.copy(game.player.position);
  game.target = target;
  game.tickPlayer(TICK, 1050);
  assert.equal(strikes(), 2);
});

test("repeat clicks, cancellation and target switches cannot bypass recovery", () => {
  const f = fixture();
  f.game.tickPlayer(TICK, 0);
  for (let i = 0; i < 10; i++) {
    f.click();
    f.game.tickPlayer(0, 0);
  }
  f.game.cancelAction();
  f.click();
  f.game.tickPlayer(0, 0);
  const next = { ...f.target, group: new THREE.Group() };
  f.game.harvestables = [next];
  f.click();
  f.game.tickPlayer(0, 0);
  assert.equal(f.strikes(), 1);
  assert.equal(f.game.attackCooldown, 1);
  assert.equal(f.game.target, next);
});

test("finishing a resource does not reset the player's recovery", () => {
  const { game, target, strikes } = fixture();
  target.hp = 10;
  game.tickPlayer(TICK, 0);
  assert.equal(strikes(), 1);
  assert.equal(target.alive, false);
  assert.equal(game.target, null);
  assert.equal(game.attackCooldown, 1);
});

test("strike immediately starts and retriggers the attack animation without looping", () => {
  const library = new ModelLibrary(),
    group = new THREE.Group();
  const mixer = new THREE.AnimationMixer(group);
  const idle = mixer.clipAction(new THREE.AnimationClip("idle", 1, []));
  const attack = mixer.clipAction(
    new THREE.AnimationClip("attack-melee-right", 0.42, []),
  );
  idle.play();
  const actor = {
    mixer,
    actions: new Map([
      ["idle", idle],
      ["attack-melee-right", attack],
    ]),
    current: "idle",
    previous: new THREE.Vector3(),
    attackUntil: 0,
    movingUntil: 0,
  };
  library.actors.set(group, actor);
  library.strike(group, 1);
  assert.equal(actor.current, "attack-melee-right");
  assert.equal(attack.isRunning(), true);
  assert.equal(attack.loop, THREE.LoopOnce);
  mixer.update(0.15);
  assert.ok(attack.time > 0);
  library.strike(group, 1.15);
  assert.equal(attack.time, 0);
  assert.equal(attack.isRunning(), true);
  library.release(group);
});
