import type { State, EquipSlot } from "./types.ts";
import * as balance from "./balance.ts";

export function workerCost(state: State): number {
  return Math.ceil(
    balance.WORKER_BASE_COST *
      Math.pow(balance.WORKER_COST_GROWTH, state.workerCount),
  );
}

export function maxAutomationSlots(state: State): number {
  return state.platformLevel * balance.PLATFORM_SLOTS_PER_LEVEL;
}

export function automationCount(state: State): number {
  return state.workerCount + state.towerCount + state.carrierCount;
}

export function towerCost(state: State): number {
  return Math.ceil(
    balance.TOWER_BASE_COST *
      Math.pow(balance.TOWER_COST_GROWTH, state.towerCount),
  );
}

export function carrierCost(state: State): number {
  return Math.ceil(
    balance.CARRIER_BASE_COST *
      Math.pow(balance.CARRIER_COST_GROWTH, state.carrierCount),
  );
}

export function currentDamage(state: State): number {
  return balance.UPGRADE_BASE_DMG * (1 + 0.08 * state.upgrades.weapon);
}

export function maxHp(state: State): number {
  return balance.PLAYER_MAX_HP + 5 * state.upgrades.armor;
}

export function attackInterval(state: State): number {
  return balance.BASE_ATTACK_INTERVAL / (1 + 0.05 * state.upgrades.gloves);
}

export function moveSpeed(state: State): number {
  return balance.MOVE_SPEED * (1 + 0.03 * state.upgrades.boots);
}

export function upgradeCost(state: State, slot: EquipSlot): number {
  return Math.ceil(
    balance.UPGRADE_BASE_COST *
      Math.pow(balance.UPGRADE_GROWTH, state.upgrades[slot]),
  );
}

export function essenceSellMult(state: State): number {
  return 1 + balance.ESSENCE_SELL_BONUS_PER_POINT * state.essence;
}

export function essenceGainPreview(state: State): number {
  return Math.floor(Math.sqrt(state.goldEarnedThisRun / 1e8));
}
