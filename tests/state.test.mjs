import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultState,
  loadState,
  normalizeState,
  saveState,
} from "../src/state.ts";
import {
  applyDailyLogin,
  applyOfflineProgress,
  claimAchievements,
  resetRun,
} from "../src/progression.ts";
import {
  automationCount,
  maxAutomationSlots,
  essenceGainPreview,
} from "../src/economy.ts";

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test("missing, malformed and non-object saves produce a usable default state", () => {
  for (const raw of [null, "{", "null", "[]", "5", '"bad"']) {
    assert.deepEqual(
      loadState(memoryStorage(raw), 1000),
      createDefaultState(1000),
    );
  }
});

test("legacy axe upgrades migrate and incomplete equipment receives defaults", () => {
  assert.deepEqual(normalizeState({ upgradeLevel: 7 }).upgrades, {
    weapon: 7,
    armor: 0,
    gloves: 0,
    boots: 0,
  });
  assert.deepEqual(normalizeState({ upgrades: { armor: 3 } }).upgrades, {
    weapon: 0,
    armor: 3,
    gloves: 0,
    boots: 0,
  });
});

test("invalid values cannot create unsupported rings, negative resources or unlimited units", () => {
  const state = normalizeState({
    gold: -2,
    wood: "100",
    meat: Infinity,
    upgrades: { weapon: NaN },
    platformLevel: 999,
    unlockedRing: 999,
    workerCount: 1000,
    towerCount: 1000,
    carrierCount: 1000,
    anchorPos: [NaN, 0],
    anchorStock: 400,
    discovered: { pine: true, oak: false, unknown: true },
    achievements: { fake: true },
  });
  assert.equal(state.gold + state.wood + state.meat, 0);
  assert.equal(state.unlockedRing, 2);
  assert.equal(state.platformLevel, 3);
  assert.equal(automationCount(state), maxAutomationSlots(state));
  assert.equal(state.anchorPos, null);
  assert.equal(state.anchorStock, 0);
  assert.deepEqual(state.discovered, { pine: true });
  assert.deepEqual(state.achievements, {});
});

test("valid saves round-trip, including meta progression and anchor stock", () => {
  const storage = memoryStorage();
  const state = Object.assign(createDefaultState(100), {
    gold: 1200,
    workerCount: 2,
    carrierCount: 1,
    anchorPos: [12, -5],
    anchorStock: 280,
    essence: 9,
    discovered: { pine: true },
    achievements: { first_worker: true },
  });
  assert.equal(saveState(storage, state, 200), true);
  assert.deepEqual(loadState(storage, 200), state);
});

test("blocked storage is recoverable and failed writes do not advance the saved timestamp", () => {
  const storage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("full");
    },
  };
  assert.deepEqual(loadState(storage, 100), createDefaultState(100));
  const state = createDefaultState(100);
  assert.equal(saveState(storage, state, 200), false);
  assert.equal(state.lastSave, 100);
});

test("offline rewards respect the eight-hour cap and cannot be claimed twice", () => {
  const state = Object.assign(createDefaultState(0), {
    workerCount: 2,
    towerCount: 1,
  });
  const now = 24 * 60 * 60 * 1000;
  assert.deepEqual(applyOfflineProgress(state, now), {
    seconds: 28800,
    wood: 4320,
    meat: 2880,
  });
  assert.equal(applyOfflineProgress(state, now).wood, 0);
  const storage = memoryStorage();
  saveState(storage, state, now);
  assert.equal(applyOfflineProgress(loadState(storage, now), now).wood, 0);
});

test("a future save timestamp or quick reload earns no offline resources", () => {
  const state = Object.assign(createDefaultState(20000), { workerCount: 1 });
  assert.equal(applyOfflineProgress(state, 10000).wood, 0);
  assert.equal(applyOfflineProgress(state, 15000).wood, 0);
});

test("daily login uses the local calendar and grants only once per day", () => {
  const state = createDefaultState();
  assert.equal(applyDailyLogin(state, new Date(2026, 8, 15, 0, 5)), 20);
  assert.equal(state.lastLoginDay, "2026-09-15");
  assert.equal(applyDailyLogin(state, new Date(2026, 8, 15, 23, 55)), 0);
  assert.equal(applyDailyLogin(state, new Date(2026, 8, 16, 0, 5)), 40);
  assert.equal(applyDailyLogin(state, new Date(2026, 8, 18)), 20);
});

test("prestige resets the run while retaining permanent progress", () => {
  const previous = Object.assign(createDefaultState(), {
    gold: 500,
    wood: 90,
    workerCount: 2,
    goldEarnedThisRun: 400000000,
    totalGoldAllTime: 600000000,
    essence: 3,
    prestigeCount: 1,
    discovered: { pine: true },
    achievements: { first_harvest: true },
    lastLoginDay: "2026-09-15",
    loginStreak: 5,
  });
  const state = resetRun(previous, essenceGainPreview(previous));
  assert.equal(
    state.gold + state.wood + state.workerCount + state.goldEarnedThisRun,
    0,
  );
  assert.equal(state.essence, 5);
  assert.equal(state.prestigeCount, 2);
  assert.equal(state.totalGoldAllTime, 600000000);
  assert.deepEqual(state.discovered, previous.discovered);
  assert.equal(state.loginStreak, 5);
  assert.equal(state.lastLoginDay, "2026-09-15");
  assert.equal(previous.gold, 500);
});

test("achievements grant their rewards once, including prestige essence", () => {
  const state = Object.assign(createDefaultState(), {
    workerCount: 1,
    prestigeCount: 1,
  });
  assert.equal(claimAchievements(state).length, 2);
  assert.equal(state.gold, 50);
  assert.equal(state.essence, 1);
  assert.deepEqual(claimAchievements(state), []);
  assert.equal(state.gold, 50);
});
