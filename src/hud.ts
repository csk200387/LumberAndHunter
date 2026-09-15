import type { EquipSlot, State, Harvestable } from "./types.ts";
import * as balance from "./balance.ts";
import * as economy from "./economy.ts";
import { icon } from "./icons.ts";

export interface HudElements {
  gold: HTMLElement;
  wood: HTMLElement;
  meat: HTMLElement;
  hp: HTMLElement;
  sellBtn: HTMLButtonElement;
  upgradeBtns: Record<EquipSlot, HTMLButtonElement>;
  expandBtn: HTMLButtonElement;
  hireBtn: HTMLButtonElement;
  towerBtn: HTMLButtonElement;
  platformBtn: HTMLButtonElement;
  anchorBtn: HTMLButtonElement;
  carrierBtn: HTMLButtonElement;
  prestigeBtn: HTMLButtonElement;
  codexBtn: HTMLButtonElement;
  achievementsBtn: HTMLButtonElement;
  infoPanel: HTMLElement;
  infoPanelTitle: HTMLElement;
  infoPanelBody: HTMLElement;
  offlineBanner: HTMLElement;
}
type Panel = "codex" | "achievements";
const number = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export class Hud {
  private toastTimer = 0;
  private hud: HudElements;
  private getState: () => State;
  private previousFocus: HTMLElement | null = null;

  constructor(elements: HudElements, getState: () => State) {
    this.hud = elements;
    this.getState = getState;
  }
  private element(id: string) {
    return this.hud.gold.ownerDocument?.getElementById(id) ?? null;
  }
  private text(id: string, value: string) {
    const el = this.element(id);
    if (el) el.textContent = value;
  }
  private fill(id: string, value: number) {
    const el = this.element(id);
    if (el) el.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
  }
  dispose() {
    clearTimeout(this.toastTimer);
  }

  private card(
    button: HTMLButtonElement,
    glyph: string,
    title: string,
    level: string,
    description: string,
    cost: number | string,
    disabled: boolean,
  ) {
    const price =
      typeof cost === "number"
        ? `${icon("coin")}${compact.format(cost)}`
        : cost;
    const html = `<span class="card-icon">${icon(glyph)}</span><span class="card-body"><span class="card-title">${title}<span class="card-level">${level}</span></span><span class="card-description">${description}</span></span><span class="card-price">${price}</span>`;
    if (button.innerHTML !== html) button.innerHTML = html;
    button.disabled = disabled;
  }

  render(
    state: State,
    playerHp: number,
    placingAnchor: boolean,
    prestigeArmed: boolean,
    ready: boolean,
  ) {
    this.hud.gold.textContent = number.format(state.gold);
    this.hud.wood.textContent = number.format(state.wood);
    this.hud.meat.textContent = number.format(state.meat);
    this.hud.hp.textContent = `${Math.ceil(playerHp)} / ${economy.maxHp(state)}`;
    this.fill("health-fill", playerHp / economy.maxHp(state));
    const equipment = {
      weapon: [
        "axe",
        "도끼",
        `채집 공격력 ${economy.currentDamage(state).toFixed(1)}`,
      ],
      armor: ["shield", "방어구", `최대 체력 ${economy.maxHp(state)}`],
      gloves: [
        "gloves",
        "장갑",
        `공격 간격 ${economy.attackInterval(state).toFixed(2)}초`,
      ],
      boots: [
        "boots",
        "부츠",
        `이동 속도 ${economy.moveSpeed(state).toFixed(1)}`,
      ],
    };
    for (const slot of balance.EQUIP_SLOTS) {
      const cost = economy.upgradeCost(state, slot),
        [glyph, title, description] = equipment[slot];
      this.card(
        this.hud.upgradeBtns[slot],
        glyph,
        title,
        `Lv.${state.upgrades[slot]}`,
        description,
        cost,
        !ready || state.gold < cost,
      );
    }
    const slots = economy.automationCount(state),
      maxSlots = economy.maxAutomationSlots(state);
    const full = slots >= maxSlots;
    this.text("slot-count", `${slots} / ${maxSlots}`);
    this.text("camp-level", `Lv.${state.platformLevel}`);
    for (const [button, glyph, label, count, description, cost] of [
      [
        this.hud.hireBtn,
        "people",
        "나무꾼",
        state.workerCount,
        "숲에서 목재를 자동으로 채집해요",
        economy.workerCost(state),
      ],
      [
        this.hud.towerBtn,
        "tower",
        "석궁탑",
        state.towerCount,
        "주변 동물을 자동으로 사냥해요",
        economy.towerCost(state),
      ],
      [
        this.hud.carrierBtn,
        "cart",
        "운반꾼",
        state.carrierCount,
        state.anchorPos
          ? "앵커의 목재를 기지로 운반해요"
          : "먼저 필드 앵커를 건설하세요",
        economy.carrierCost(state),
      ],
    ] as const)
      this.card(
        button,
        glyph,
        label,
        `${count} / ${maxSlots}`,
        description,
        full ? "슬롯 가득" : cost,
        !ready ||
          full ||
          state.gold < cost ||
          (button === this.hud.carrierBtn && !state.anchorPos),
      );
    this.card(
      this.hud.anchorBtn,
      "flag",
      "필드 앵커",
      "",
      state.anchorPos
        ? `보관 목재 ${state.anchorStock} / ${balance.ANCHOR_CAPACITY}`
        : "숲속에 작은 보급 거점을 세워요",
      state.anchorPos
        ? "건설 완료"
        : placingAnchor
          ? "위치 선택 중"
          : balance.ANCHOR_COST,
      !ready ||
        !!state.anchorPos ||
        placingAnchor ||
        state.gold < balance.ANCHOR_COST,
    );
    const nextRing = state.unlockedRing + 1,
      ringCost = balance.RING_COST[nextRing];
    this.card(
      this.hud.expandBtn,
      "map",
      "영토 확장",
      `링 ${state.unlockedRing}`,
      "참나무와 새로운 야생동물을 만나세요",
      ringCost ?? "탐험 완료",
      !ready || ringCost === undefined || state.gold < ringCost,
    );
    const nextLevel = state.platformLevel + 1,
      platformCost = balance.platformUpgradeCost(nextLevel);
    this.card(
      this.hud.platformBtn,
      "camp",
      "야영지 확장",
      `Lv.${state.platformLevel}`,
      "더 많은 동료와 시설을 위한 자리",
      nextLevel > balance.PLATFORM_MAX_LEVEL ? "최대 레벨" : platformCost,
      !ready ||
        nextLevel > balance.PLATFORM_MAX_LEVEL ||
        state.gold < platformCost,
    );
    const gain = economy.essenceGainPreview(state);
    this.card(
      this.hud.prestigeBtn,
      "spark",
      "새로운 여정",
      `정수 ${state.essence}`,
      prestigeArmed
        ? "다시 누르면 이번 여정을 초기화해요"
        : "성장의 기억을 안고 다시 시작하세요",
      prestigeArmed ? "초기화 확정" : `+${gain} 정수`,
      !ready || (!prestigeArmed && gain < 1),
    );
    const sale = Math.round(
      (state.wood * balance.WOOD_SELL_PRICE +
        state.meat * balance.MEAT_SELL_PRICE) *
        economy.essenceSellMult(state),
    );
    this.hud.sellBtn.disabled = !ready || sale <= 0;
    this.hud.sellBtn.innerHTML = `${sale > 0 ? `${compact.format(sale)} G · 모두 판매` : "판매할 자원을 모아보세요"} ${icon("arrow")}`;
    const mult = economy.essenceSellMult(state);
    this.text(
      "trade-prices",
      `목재 ${(2 * mult).toFixed(mult === 1 ? 0 : 2)}G · 고기 ${(5 * mult).toFixed(mult === 1 ? 0 : 2)}G`,
    );
    this.hud.codexBtn.innerHTML = `${icon("book")}<span>도감</span><small>${Object.keys(state.discovered).length} / 6</small>`;
    this.hud.achievementsBtn.innerHTML = `${icon("trophy")}<span>업적</span><small>${Object.keys(state.achievements).length} / 6</small>`;
    this.hud.codexBtn.disabled = !ready;
    this.hud.achievementsBtn.disabled = !ready;
    this.text(
      "region-progress",
      `도감 ${Object.keys(state.discovered).length} / 6 발견`,
    );
    const deepForest = state.unlockedRing >= 2;
    this.text(
      "region-chapter",
      deepForest ? "CHAPTER 02 · DEEPWOOD" : "CHAPTER 01 · GREENWOOD",
    );
    this.text("region-name", deepForest ? "깊은 숲의 개척지" : "초록빛 개척지");
    this.text("region-mood", deepForest ? "안개가 짙어지는 숲" : "평화로운 숲");
    const quest = !state.discovered.pine
      ? [
          "첫 번째 나무를 베어보세요",
          "나무를 클릭하면 다가가서 자동으로 채집해요.",
          0.05,
        ]
      : state.totalGoldAllTime < 20
        ? [
            "숲에서 얻은 자원을 판매하세요",
            "개척지에서 모두 판매를 눌러 골드를 모아요.",
            state.totalGoldAllTime / 20,
          ]
        : state.workerCount === 0
          ? [
              "첫 동료와 함께하는 숲",
              "200 골드를 모아 동료 탭에서 나무꾼을 고용해요.",
              state.gold / 200,
            ]
          : state.unlockedRing === 1
            ? [
                "숲 너머로 향하는 발걸음",
                "1,000 골드로 더 넓은 숲을 개척해 보세요.",
                state.gold / 1000,
              ]
            : [
                "당신만의 개척지를 만드세요",
                "동료를 늘리고 모든 동물을 도감에 기록해요.",
                Object.keys(state.discovered).length / 6,
              ];
    this.text("quest-title", String(quest[0]));
    this.text("quest-description", String(quest[1]));
    this.fill("quest-fill", Number(quest[2]));
    if (!this.hud.infoPanel.hidden)
      this.renderPanel(this.hud.infoPanel.dataset.which as Panel);
  }

  target(target: Harvestable | null) {
    const card = this.element("target-card");
    if (!card) return;
    card.hidden = !target?.alive;
    if (target?.alive) {
      this.text("target-name", balance.SPECIES_NAME[target.species]);
      this.text("target-hp", `${Math.ceil(target.hp)} / ${target.maxHp}`);
      this.fill("target-health-fill", target.hp / target.maxHp);
    }
  }

  loading(error?: string) {
    if (error) this.text("loading-message", error);
    else this.element("loading-screen")?.classList.add("done");
  }

  closePanel() {
    this.hud.infoPanel.hidden = true;
    this.previousFocus?.focus();
  }

  togglePanel(which: Panel) {
    if (
      !this.hud.infoPanel.hidden &&
      this.hud.infoPanel.dataset.which === which
    ) {
      this.closePanel();
      return;
    }
    this.previousFocus = this.hud.gold.ownerDocument
      ?.activeElement as HTMLElement | null;
    this.hud.infoPanel.dataset.which = which;
    this.renderPanel(which);
    this.hud.infoPanel.hidden = false;
    this.element("info-panel-close")?.focus();
  }

  private renderPanel(which: Panel) {
    const state = this.getState();
    this.hud.infoPanelTitle.textContent =
      which === "codex" ? "숲의 기록" : "개척자의 발자취";
    const html =
      which === "codex"
        ? (Object.keys(balance.SPECIES) as (keyof typeof balance.SPECIES)[])
            .map((species) => {
              const known = state.discovered[species],
                cfg = balance.SPECIES[species];
              return `<div class="journal-entry ${known ? "" : "locked"}">${icon(cfg.kind === "tree" ? "tree" : "meat")}<span class="entry-status">${known ? "발견 완료" : "미발견"}</span><strong>${known ? balance.SPECIES_NAME[species] : "아직 만나지 못한 생명"}</strong><small>링 ${cfg.ring} · ${cfg.kind === "tree" ? "목재 자원" : "야생동물"}<br>체력 ${cfg.hp} · 재생성 ${cfg.respawnSec}초</small></div>`;
            })
            .join("")
        : balance.ACHIEVEMENTS.map(
            (a) =>
              `<div class="journal-entry ${state.achievements[a.id] ? "" : "locked"}">${icon("trophy")}<span class="entry-status">${state.achievements[a.id] ? "달성 완료" : "도전 중"}</span><strong>${a.label}</strong><small>보상 · ${a.reward ? `${a.reward} 골드` : "정수 1개"}</small></div>`,
          ).join("");
    if (this.hud.infoPanelBody.innerHTML !== html)
      this.hud.infoPanelBody.innerHTML = html;
  }

  showToast(message: string, ms = 6000) {
    clearTimeout(this.toastTimer);
    this.hud.offlineBanner.textContent = message;
    this.hud.offlineBanner.hidden = false;
    this.toastTimer = window.setTimeout(() => {
      this.hud.offlineBanner.hidden = true;
    }, ms);
  }
}
