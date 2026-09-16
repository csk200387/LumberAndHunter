import assert from "node:assert/strict";
import test from "node:test";
import { chooseGrowthAction, AUTO_MODE_COPY } from "../src/auto-mode.ts";
import { Game } from "../src/game.ts";
import * as THREE from "three";
import {
  createDefaultState,
  normalizeState,
  saveState,
  loadState,
} from "../src/state.ts";
import * as economy from "../src/economy.ts";

test("automatic modes default to off and survive save round-trips", () => {
  const storage = {
    value: null,
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = value;
    },
  };
  assert.equal(createDefaultState().autoMode, "off");
  assert.equal(normalizeState({ autoMode: "earn" }).autoMode, "earn");
  assert.equal(normalizeState({ autoMode: "grow" }).autoMode, "grow");
  assert.equal(normalizeState({ autoMode: "danger" }).autoMode, "off");
  const state = createDefaultState(100);
  state.autoMode = "grow";
  assert.equal(saveState(storage, state, 200), true);
  assert.equal(loadState(storage, 200).autoMode, "grow");
});

test("earn mode never spends gold and grow mode only acts on affordable purchases", () => {
  const state = createDefaultState();
  state.autoMode = "earn";
  state.gold = 100000;
  assert.equal(chooseGrowthAction(state), null);
  state.autoMode = "grow";
  state.gold = 0;
  assert.equal(chooseGrowthAction(state), null);
  state.gold = economy.upgradeCost(state, "weapon") - 1;
  assert.equal(chooseGrowthAction(state), null);
});

test("growth chooses the cheapest useful upgrade before expensive expansion", () => {
  const state = createDefaultState();
  state.autoMode = "grow";
  state.gold = 1000;
  assert.deepEqual(chooseGrowthAction(state), {
    type: "upgrade",
    slot: "weapon",
  });
  state.upgrades.weapon = 50;
  state.upgrades.armor = 50;
  state.upgrades.gloves = 50;
  state.upgrades.boots = 50;
  state.gold = 1000;
  assert.deepEqual(chooseGrowthAction(state), { type: "worker" });
});

test("mode copy clearly distinguishes manual, earnings-only and growth modes", () => {
  assert.match(AUTO_MODE_COPY.off[1], /직접/);
  assert.match(AUTO_MODE_COPY.earn[1], /자동 판매/);
  assert.match(AUTO_MODE_COPY.grow[1], /성장 구매/);
});

test("earn mode selects a nearby resource and sells, while grow mode also buys once", () => {
  const game = Object.create(Game.prototype);
  const near = { alive: true, group: new THREE.Group() };
  near.group.position.set(2, 0, 0);
  const far = { alive: true, group: new THREE.Group() };
  far.group.position.set(8, 0, 0);
  let sales = 0,
    upgrades = 0;
  Object.assign(game, {
    state: Object.assign(createDefaultState(), { autoMode: "earn" }),
    player: new THREE.Group(),
    harvestables: [far, near],
    target: null,
    moveTarget: null,
    autoTimer: 0,
    sellAll: (quiet) => {
      assert.equal(quiet, true);
      sales++;
    },
    buyUpgrade: () => upgrades++,
    hireWorker() {},
    buildTower() {},
    buyRingExpansion() {},
  });
  game.tickAuto(0.5);
  assert.equal(game.target, near);
  assert.deepEqual(game.moveTarget.toArray(), [2, 0, 0]);
  assert.equal(sales, 1);
  assert.equal(upgrades, 0);
  game.state.autoMode = "grow";
  game.state.gold = 10;
  game.tickAuto(0.5);
  assert.equal(sales, 2);
  assert.equal(upgrades, 1);
});
