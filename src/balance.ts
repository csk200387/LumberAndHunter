import type { EquipSlot, Species, State } from "./types.ts";

export const TICK = 1 / 20;
export const MOVE_SPEED = 4.5;
export const ATTACK_RANGE = 2.0;
export const BASE_ATTACK_INTERVAL = 1.0; // seconds per player swing, before gloves
export const UPGRADE_BASE_COST = 10;
export const UPGRADE_GROWTH = 1.15;
export const UPGRADE_BASE_DMG = 10;

// Only equipment with implemented gameplay effects is available.
export const EQUIP_SLOTS: EquipSlot[] = ["weapon", "armor", "gloves", "boots"];
export const EQUIP_LABEL: Record<EquipSlot, string> = {
  weapon: "도끼",
  armor: "방어구",
  gloves: "장갑",
  boots: "부츠",
};

export const WOOD_SELL_PRICE = 2;
export const MEAT_SELL_PRICE = 5;
export const ANIMAL_WANDER_RADIUS = 4;

export const PLAYER_MAX_HP = 100;
export const DEATH_STUN_MS = 5000; // per PLAN.md 4.3: death penalty = return to base + 5s wait

export const SAVE_KEY = "lh_save_v1";
export const SAVE_INTERVAL_MS = 10_000;

// 나무꾼 (woodcutter worker) per PLAN.md 15: first automation hire, chops trees unattended.
export const WORKER_BASE_COST = 200;
export const WORKER_COST_GROWTH = 1.25; // W(n) = W0 x 1.25^n per PLAN.md 10
export const WORKER_DAMAGE = 8;
export const WORKER_ATTACK_INTERVAL = 1.2;
export const WORKER_SPEED = 3.0;

// 석궁탑 (crossbow tower): stationary, shoots the nearest animal in range unattended.
// No tower HP/durability yet — animals can't damage it back, only chase the player.
export const TOWER_BASE_COST = 500;
export const TOWER_COST_GROWTH = 1.25;
export const TOWER_DAMAGE = 15;
export const TOWER_ATTACK_INTERVAL = 1.5;
export const TOWER_RANGE = 8;

// Platform level gates the combined worker, tower and carrier slots.
export const PLATFORM_MAX_LEVEL = 3;
export const PLATFORM_SLOTS_PER_LEVEL = 6;
export function platformUpgradeCost(nextLevel: number): number {
  return 5000 * Math.pow(16, nextLevel - 2);
}

// Offline rewards use estimated automation throughput at a 50% discount.
export const WORKER_WOOD_PER_SEC = 0.15;
export const TOWER_MEAT_PER_SEC = 0.2;
export const OFFLINE_DISCOUNT = 0.5;
export const OFFLINE_CAP_SEC = 8 * 60 * 60;

// A single field anchor stores worker output until carriers return it to base.
export const ANCHOR_COST = 800;
export const ANCHOR_CAPACITY = 300;
export const CARRIER_BASE_COST = 300;
export const CARRIER_COST_GROWTH = 1.25;
export const CARRIER_SPEED = 3.5;
export const CARRIER_CARRY_CAPACITY = 50;
export const ARRIVE_DIST = 1.0;

// Prestige preserves meta progression; each essence adds a 1% sale bonus.
export const ESSENCE_SELL_BONUS_PER_POINT = 0.01;
export const PRESTIGE_ARM_MS = 6000; // click once to arm, again within this window to confirm (no native confirm())

export const SPECIES_NAME: Record<Species, string> = {
  pine: "소나무",
  oak: "참나무",
  rabbit: "토끼",
  chicken: "닭",
  deer: "사슴",
  boar: "멧돼지",
};

interface Achievement {
  id: string;
  label: string;
  reward: number; // gold, except 'first_prestige' which grants +1 essence instead
  check: (s: State) => boolean;
}
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_harvest",
    label: "첫 채집",
    reward: 10,
    check: (s) => Object.keys(s.discovered).length >= 1,
  },
  {
    id: "first_worker",
    label: "첫 나무꾼 고용",
    reward: 50,
    check: (s) => s.workerCount >= 1,
  },
  {
    id: "gold_1000",
    label: "누적 골드 1000",
    reward: 100,
    check: (s) => s.totalGoldAllTime >= 1000,
  },
  {
    id: "ring2",
    label: "링2 확장",
    reward: 200,
    check: (s) => s.unlockedRing >= 2,
  },
  {
    id: "platform_max",
    label: "플랫폼 Lv.3 달성",
    reward: 500,
    check: (s) => s.platformLevel >= 3,
  },
  {
    id: "first_prestige",
    label: "첫 프레스티지",
    reward: 0,
    check: (s) => s.prestigeCount >= 1,
  },
];

// Balance table per PLAN.md 4.1-4.3 (JSON data files come later, M2).
export const SPECIES: Record<
  Species,
  {
    kind: "tree" | "animal";
    ring: number;
    hp: number;
    respawnSec: number;
    woodMin?: number;
    woodMax?: number;
    meatMin?: number;
    meatMax?: number;
    aggressive?: boolean;
    speed?: number; // wander or chase speed
    aggroRange?: number;
    damage?: number;
    attackInterval?: number;
  }
> = {
  pine: {
    kind: "tree",
    ring: 1,
    hp: 80,
    respawnSec: 35,
    woodMin: 2,
    woodMax: 3,
  },
  oak: {
    kind: "tree",
    ring: 2,
    hp: 120,
    respawnSec: 45,
    woodMin: 4,
    woodMax: 6,
  },
  rabbit: {
    kind: "animal",
    ring: 1,
    hp: 40,
    respawnSec: 60,
    meatMin: 2,
    meatMax: 4,
    speed: 1.2,
  },
  chicken: {
    kind: "animal",
    ring: 1,
    hp: 25,
    respawnSec: 40,
    meatMin: 1,
    meatMax: 2,
    speed: 1.0,
  },
  deer: {
    kind: "animal",
    ring: 2,
    hp: 60,
    respawnSec: 50,
    meatMin: 3,
    meatMax: 5,
    speed: 1.5,
  },
  boar: {
    kind: "animal",
    ring: 2,
    hp: 200,
    respawnSec: 60,
    meatMin: 4,
    meatMax: 8,
    aggressive: true,
    speed: 3.2,
    aggroRange: 5,
    damage: 4,
    attackInterval: 1.2,
  },
};

// ring N unlock cost in gold, keyed by the ring being unlocked (ring 1 is free/start).
export const RING_COST: Record<number, number> = { 2: 1000 };
export const RING_BAND: Record<number, [number, number]> = {
  1: [8, 22],
  2: [24, 42],
};
// ring 3+ deferred: no willow/crocodile assets/species yet; RING_COST only goes to 2
