import type { State } from "./types.ts";
import {
  ACHIEVEMENTS,
  ANCHOR_CAPACITY,
  EQUIP_SLOTS,
  PLATFORM_MAX_LEVEL,
  PLATFORM_SLOTS_PER_LEVEL,
  RING_BAND,
  SAVE_KEY,
  SPECIES,
} from "./balance.ts";

type StorageAccess = Pick<Storage, "getItem" | "setItem">;

export function createDefaultState(now = Date.now()): State {
  return {
    gold: 0,
    autoMode: "off",
    worldTime: 0,
    wood: 0,
    meat: 0,
    upgrades: { weapon: 0, armor: 0, gloves: 0, boots: 0 },
    unlockedRing: 1,
    workerCount: 0,
    towerCount: 0,
    platformLevel: 1,
    lastSave: now,
    anchorPos: null,
    anchorStock: 0,
    carrierCount: 0,
    essence: 0,
    prestigeCount: 0,
    goldEarnedThisRun: 0,
    totalGoldAllTime: 0,
    discovered: {},
    achievements: {},
    lastLoginDay: null,
    loginStreak: 0,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function integer(
  value: unknown,
  fallback = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), max)
    : fallback;
}

/** Validate individual fields so a damaged field does not discard the entire save. */
export function normalizeState(value: unknown, now = Date.now()): State {
  const raw = record(value);
  const state = createDefaultState(now);
  for (const key of [
    "gold",
    "wood",
    "meat",
    "essence",
    "prestigeCount",
    "goldEarnedThisRun",
    "totalGoldAllTime",
    "loginStreak",
    "worldTime",
  ] as const) {
    state[key] = integer(raw[key]);
  }
  if (raw.autoMode === "earn" || raw.autoMode === "grow")
    state.autoMode = raw.autoMode;
  const upgrades = record(raw.upgrades);
  for (const slot of EQUIP_SLOTS) {
    state.upgrades[slot] = integer(
      upgrades[slot] ?? (slot === "weapon" ? raw.upgradeLevel : 0),
    );
  }
  state.unlockedRing = Math.max(
    1,
    integer(
      raw.unlockedRing,
      1,
      Math.max(...Object.keys(RING_BAND).map(Number)),
    ),
  );
  state.platformLevel = Math.max(
    1,
    integer(raw.platformLevel, 1, PLATFORM_MAX_LEVEL),
  );
  let slots = state.platformLevel * PLATFORM_SLOTS_PER_LEVEL;
  for (const key of ["workerCount", "towerCount", "carrierCount"] as const) {
    state[key] = integer(raw[key], 0, slots);
    slots -= state[key];
  }
  state.lastSave = integer(raw.lastSave, now, now);
  if (
    Array.isArray(raw.anchorPos) &&
    raw.anchorPos.length === 2 &&
    raw.anchorPos.every(
      (v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 55,
    )
  ) {
    state.anchorPos = [raw.anchorPos[0], raw.anchorPos[1]];
    state.anchorStock = integer(raw.anchorStock, 0, ANCHOR_CAPACITY);
  }
  if (!state.anchorPos) state.carrierCount = 0;
  const discovered = record(raw.discovered);
  for (const species of Object.keys(SPECIES) as (keyof typeof SPECIES)[]) {
    if (discovered[species] === true) state.discovered[species] = true;
  }
  const achievements = record(raw.achievements);
  for (const { id } of ACHIEVEMENTS) {
    if (achievements[id] === true) state.achievements[id] = true;
  }
  if (
    typeof raw.lastLoginDay === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.lastLoginDay)
  ) {
    state.lastLoginDay = raw.lastLoginDay;
  }
  return state;
}

export function loadState(storage?: StorageAccess, now = Date.now()): State {
  try {
    const raw = (storage ?? window.localStorage).getItem(SAVE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : null, now);
  } catch {
    return createDefaultState(now);
  }
}

export function saveState(
  storage: StorageAccess | undefined,
  state: State,
  now = Date.now(),
): boolean {
  try {
    (storage ?? window.localStorage).setItem(
      SAVE_KEY,
      JSON.stringify({ ...state, lastSave: now }),
    );
    state.lastSave = now;
    return true;
  } catch {
    return false;
  }
}
