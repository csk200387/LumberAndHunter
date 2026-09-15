import type { State } from "./types.ts";
import {
  ACHIEVEMENTS,
  OFFLINE_CAP_SEC,
  OFFLINE_DISCOUNT,
  TOWER_MEAT_PER_SEC,
  WORKER_WOOD_PER_SEC,
} from "./balance.ts";
import { createDefaultState } from "./state.ts";

export function applyOfflineProgress(state: State, now = Date.now()) {
  const seconds = Math.min(
    Math.max((now - state.lastSave) / 1000, 0),
    OFFLINE_CAP_SEC,
  );
  state.lastSave = now;
  const wood =
    seconds < 10
      ? 0
      : Math.floor(
          state.workerCount * WORKER_WOOD_PER_SEC * seconds * OFFLINE_DISCOUNT,
        );
  const meat =
    seconds < 10
      ? 0
      : Math.floor(
          state.towerCount * TOWER_MEAT_PER_SEC * seconds * OFFLINE_DISCOUNT,
        );
  state.wood += wood;
  state.meat += meat;
  return { seconds, wood, meat };
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function applyDailyLogin(state: State, now = new Date()): number {
  const today = localDay(now);
  if (state.lastLoginDay === today) return 0;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  state.loginStreak =
    state.lastLoginDay === localDay(yesterday) ? state.loginStreak + 1 : 1;
  state.lastLoginDay = today;
  const reward = 20 * state.loginStreak;
  state.gold += reward;
  return reward;
}

export function claimAchievements(state: State): string[] {
  const messages: string[] = [];
  for (const achievement of ACHIEVEMENTS) {
    if (state.achievements[achievement.id] || !achievement.check(state))
      continue;
    state.achievements[achievement.id] = true;
    if (achievement.id === "first_prestige") state.essence++;
    else state.gold += achievement.reward;
    messages.push(
      `업적 달성: ${achievement.label}${achievement.reward > 0 ? ` (+${achievement.reward}G)` : " (정수 +1)"}`,
    );
  }
  return messages;
}

export function resetRun(state: State, essenceGain: number): State {
  return {
    ...createDefaultState(),
    essence: state.essence + essenceGain,
    prestigeCount: state.prestigeCount + 1,
    totalGoldAllTime: state.totalGoldAllTime,
    discovered: { ...state.discovered },
    achievements: { ...state.achievements },
    lastLoginDay: state.lastLoginDay,
    loginStreak: state.loginStreak,
  };
}
