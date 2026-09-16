import type * as THREE from "three";

export type EquipSlot = "weapon" | "armor" | "gloves" | "boots";
export type AutoMode = "off" | "earn" | "grow";
export type Species = "pine" | "oak" | "rabbit" | "chicken" | "boar" | "deer";

export interface Harvestable {
  group: THREE.Group;
  species: Species;
  kind: "tree" | "animal";
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnAt: number;
  home: THREE.Vector3;
  // animal-only wander/aggro state
  wanderTarget: THREE.Vector3 | null;
  nextWanderAt: number;
  attackTimer: number;
}

export interface WorkerUnit {
  group: THREE.Group;
  target: Harvestable | null;
  attackTimer: number;
}

export interface TowerUnit {
  group: THREE.Group;
  target: Harvestable | null;
  attackTimer: number;
}

export interface CarrierUnit {
  group: THREE.Group;
  carrying: number;
}

export interface State {
  autoMode: AutoMode;
  gold: number;
  wood: number;
  meat: number;
  upgrades: Record<EquipSlot, number>;
  unlockedRing: number;
  workerCount: number;
  towerCount: number;
  platformLevel: number;
  lastSave: number;
  anchorPos: [number, number] | null;
  anchorStock: number;
  carrierCount: number;
  essence: number;
  prestigeCount: number;
  goldEarnedThisRun: number;
  totalGoldAllTime: number;
  discovered: Partial<Record<Species, true>>;
  achievements: Partial<Record<string, true>>;
  lastLoginDay: string | null;
  loginStreak: number;
}
