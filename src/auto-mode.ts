import type { AutoMode, EquipSlot, State } from "./types.ts";
import * as balance from "./balance.ts";
import * as economy from "./economy.ts";

export type GrowthAction =
  | { type: "upgrade"; slot: EquipSlot }
  | { type: "worker" }
  | { type: "tower" }
  | { type: "expand" }
  | null;
type PricedGrowthAction = Exclude<GrowthAction, null> & { cost: number };

/** One affordable improvement per pulse; never performs prestige or anchor placement. */
export function chooseGrowthAction(state: State): GrowthAction {
  if (state.autoMode !== "grow") return null;
  const upgrades = balance.EQUIP_SLOTS.map((slot) => ({
    type: "upgrade" as const,
    slot,
    cost: economy.upgradeCost(state, slot),
  }));
  const actions: Array<PricedGrowthAction | null> = [
    ...upgrades,
    economy.automationCount(state) < economy.maxAutomationSlots(state)
      ? { type: "worker", cost: economy.workerCost(state) }
      : null,
    economy.automationCount(state) < economy.maxAutomationSlots(state)
      ? { type: "tower", cost: economy.towerCost(state) }
      : null,
    balance.RING_COST[state.unlockedRing + 1] !== undefined
      ? { type: "expand", cost: balance.RING_COST[state.unlockedRing + 1] }
      : null,
  ];
  const affordable = actions.filter(
    (action): action is PricedGrowthAction =>
      !!action && action.cost <= state.gold,
  );
  if (!affordable.length) return null;
  affordable.sort((a, b) => a.cost! - b.cost!);
  const { cost: _cost, ...action } = affordable[0];
  return action;
}

export const AUTO_MODE_COPY: Record<AutoMode, [string, string]> = {
  off: ["수동", "직접 이동하고 채집합니다"],
  earn: ["골드 수집", "자동 채집 · 자동 판매"],
  grow: ["자동 성장", "채집 · 판매 · 성장 구매"],
};
