// Headless economy estimate: logistics and combat timing are not simulated.
// Balance values and purchase formulas are shared with the live game.
import { EQUIP_SLOTS, PLATFORM_MAX_LEVEL, RING_COST, WOOD_SELL_PRICE, MEAT_SELL_PRICE,
  WORKER_WOOD_PER_SEC, TOWER_MEAT_PER_SEC, platformUpgradeCost } from '../src/balance.ts';
import { automationCount, maxAutomationSlots, upgradeCost, workerCost, towerCost } from '../src/economy.ts';
import { createDefaultState } from '../src/state.ts';

const TICK_SEC = 60;
const TOTAL_TICKS = 7 * 24 * 60; // 1 week, 1-minute resolution
const STALL_THRESHOLD_SEC = 30 * 60;

// Flat estimate of manual harvesting during the "3 sessions/day, 15min" active play the
// design doc targets (PLAN.md 1: 세션 목표). Not weapon-scaled — a simplification.
const PLAYER_ACTIVE_WOOD_PER_SEC = 0.2;
const PLAYER_ACTIVE_MEAT_PER_SEC = 0.2;
const SESSION_STARTS_MIN = [0, 480, 960]; // 3 sessions/day, 8h apart
const SESSION_LEN_MIN = 15;

function isActiveTick(tick) {
  const minuteOfDay = tick % 1440;
  return SESSION_STARTS_MIN.some((start) => minuteOfDay >= start && minuteOfDay < start + SESSION_LEN_MIN);
}

function candidates(s) {
  const list = [];
  for (const slot of EQUIP_SLOTS) {
    list.push({
      label: `${slot} 강화 Lv.${s.upgrades[slot]}->${s.upgrades[slot] + 1}`,
      cost: upgradeCost(s, slot),
      apply: () => s.upgrades[slot]++,
    });
  }
  const nextRing = s.unlockedRing + 1;
  if (RING_COST[nextRing] !== undefined) {
    list.push({ label: `링${nextRing} 확장`, cost: RING_COST[nextRing], apply: () => (s.unlockedRing = nextRing) });
  }
  if (automationCount(s) < maxAutomationSlots(s)) {
    list.push({
      label: `나무꾼 고용 #${s.workerCount + 1}`,
      cost: workerCost(s),
      apply: () => s.workerCount++,
    });
    list.push({
      label: `석궁탑 건설 #${s.towerCount + 1}`,
      cost: towerCost(s),
      apply: () => s.towerCount++,
    });
  }
  if (s.platformLevel < PLATFORM_MAX_LEVEL) {
    list.push({
      label: `플랫폼 Lv.${s.platformLevel}->${s.platformLevel + 1}`,
      cost: platformUpgradeCost(s.platformLevel + 1),
      apply: () => s.platformLevel++,
    });
  }
  return list;
}

function formatTick(tick) {
  const day = Math.floor(tick / 1440) + 1;
  const hour = Math.floor((tick % 1440) / 60);
  const min = tick % 60;
  return `Day${day} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function run() {
  const s = createDefaultState();
  const purchases = [];
  const bottlenecks = [];
  let gapStartTick = null;
  let gapStartInfo = null;
  let invariantOk = true;

  for (let tick = 0; tick < TOTAL_TICKS; tick++) {
    s.wood += s.workerCount * WORKER_WOOD_PER_SEC * TICK_SEC;
    s.meat += s.towerCount * TOWER_MEAT_PER_SEC * TICK_SEC;
    if (isActiveTick(tick)) {
      s.wood += PLAYER_ACTIVE_WOOD_PER_SEC * TICK_SEC;
      s.meat += PLAYER_ACTIVE_MEAT_PER_SEC * TICK_SEC;
    }

    s.gold += s.wood * WOOD_SELL_PRICE + s.meat * MEAT_SELL_PRICE;
    s.wood = 0;
    s.meat = 0;

    let boughtThisTick = false;
    for (;;) {
      const avail = candidates(s);
      if (avail.length === 0) break;
      const cheapest = avail.reduce((a, b) => (b.cost < a.cost ? b : a));
      if (s.gold >= cheapest.cost) {
        s.gold -= cheapest.cost;
        cheapest.apply();
        purchases.push({ tick, label: cheapest.label, cost: cheapest.cost });
        boughtThisTick = true;
      } else {
        if (gapStartTick === null) {
          gapStartTick = tick;
          gapStartInfo = { label: cheapest.label, cost: cheapest.cost, gold: Math.floor(s.gold) };
        }
        break;
      }
    }

    if (boughtThisTick && gapStartTick !== null) {
      const gapSec = (tick - gapStartTick) * TICK_SEC;
      if (gapSec >= STALL_THRESHOLD_SEC) {
        bottlenecks.push({
          start: gapStartTick,
          end: tick,
          minutes: Math.round(gapSec / 60),
          ...gapStartInfo,
        });
      }
      gapStartTick = null;
      gapStartInfo = null;
    }

    if (s.gold < 0 || s.wood < 0 || s.meat < 0) invariantOk = false;
  }

  if (gapStartTick !== null) {
    const gapSec = (TOTAL_TICKS - gapStartTick) * TICK_SEC;
    if (gapSec >= STALL_THRESHOLD_SEC) {
      bottlenecks.push({
        start: gapStartTick,
        end: TOTAL_TICKS,
        minutes: Math.round(gapSec / 60),
        ...gapStartInfo,
        ongoing: true,
      });
    }
  }

  console.log('=== Lumber & Hunt balance sim (1 week, optimal bot) ===');
  console.log(
    `최종 상태: 골드 ${Math.floor(s.gold)}, 링 ${s.unlockedRing}, 플랫폼 Lv.${s.platformLevel}, ` +
      `나무꾼 ${s.workerCount}, 석궁탑 ${s.towerCount}, 강화 ${EQUIP_SLOTS.map((k) => `${k}${s.upgrades[k]}`).join('/')}`,
  );
  console.log(`구매 횟수: ${purchases.length}`);
  console.log('');

  if (bottlenecks.length === 0) {
    console.log(`병목 없음: 30분 이상 아무것도 못 사는 구간이 없었습니다.`);
  } else {
    console.log(`병목 ${bottlenecks.length}건 발견 (30분 이상 구매 불가 구간):`);
    for (const b of bottlenecks) {
      const tag = b.ongoing ? ' [시뮬레이션 종료 시점까지 지속]' : '';
      console.log(
        `  - ${formatTick(b.start)} ~ ${formatTick(b.end)} (${b.minutes}분): ` +
          `'${b.label}' (${b.cost}G) 대기 중, 보유 골드 ${b.gold}G${tag}`,
      );
    }
  }
  console.log('');
  console.log(invariantOk ? 'SELF-CHECK PASS (음수 자원 없음)' : 'SELF-CHECK FAIL (음수 자원 발생!)');

  if (!invariantOk) process.exit(1);
}

run();
