import "./style.css";
import { Game } from "./game";
import type { AutoMode } from "./types.ts";
import { createInterface } from "./interface.ts";

createInterface();

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`필수 화면 요소가 없습니다: ${selector}`);
  return result;
}

const canvasHolder = element<HTMLDivElement>("#canvas-holder");

const game = new Game(canvasHolder, {
  gold: element<HTMLElement>("#hud-gold"),
  wood: element<HTMLElement>("#hud-wood"),
  meat: element<HTMLElement>("#hud-meat"),
  hp: element<HTMLElement>("#hud-hp"),
  sellBtn: element<HTMLButtonElement>("#sell-btn"),
  upgradeBtns: {
    weapon: element<HTMLButtonElement>("#upgrade-weapon-btn"),
    armor: element<HTMLButtonElement>("#upgrade-armor-btn"),
    gloves: element<HTMLButtonElement>("#upgrade-gloves-btn"),
    boots: element<HTMLButtonElement>("#upgrade-boots-btn"),
  },
  expandBtn: element<HTMLButtonElement>("#expand-btn"),
  hireBtn: element<HTMLButtonElement>("#hire-btn"),
  towerBtn: element<HTMLButtonElement>("#tower-btn"),
  platformBtn: element<HTMLButtonElement>("#platform-btn"),
  anchorBtn: element<HTMLButtonElement>("#anchor-btn"),
  carrierBtn: element<HTMLButtonElement>("#carrier-btn"),
  prestigeBtn: element<HTMLButtonElement>("#prestige-btn"),
  codexBtn: element<HTMLButtonElement>("#codex-btn"),
  achievementsBtn: element<HTMLButtonElement>("#achievements-btn"),
  infoPanel: element<HTMLElement>("#info-panel"),
  infoPanelTitle: element<HTMLElement>("#info-panel-title"),
  infoPanelBody: element<HTMLElement>("#info-panel-body"),
  offlineBanner: element<HTMLElement>("#offline-banner"),
});

for (const mode of ["off", "earn", "grow"] as const)
  element<HTMLButtonElement>(`#auto-mode-${mode}`).addEventListener(
    "click",
    () => game.setAutoMode(mode as AutoMode),
  );

const closePanel = () => {
  game.closeJournal();
};
const closeButton = element<HTMLButtonElement>("#info-panel-close");
closeButton.addEventListener("click", closePanel);

const events = new AbortController();
const options = { signal: events.signal };
const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-tab]")];
function selectTab(selected: HTMLButtonElement) {
  for (const tab of tabs) {
    const active = tab === selected;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    element(`#pane-${tab.dataset.tab}`).hidden = !active;
  }
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => selectTab(tab), options);
  tab.addEventListener(
    "keydown",
    (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const next =
        tabs[
          (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length
        ];
      selectTab(next);
      next.focus();
    },
    options,
  );
}
selectTab(tabs[0]);
const campPanel = element("#camp-panel");
const campToggle = element<HTMLButtonElement>("#camp-toggle-btn");
function setCampOpen(open: boolean) {
  campPanel.classList.toggle("collapsed", !open);
  campPanel.inert = !open;
  campToggle.setAttribute("aria-expanded", String(open));
}
const smallScreen = window.matchMedia("(max-width: 760px)");
setCampOpen(!smallScreen.matches);
smallScreen.addEventListener(
  "change",
  () => setCampOpen(!smallScreen.matches),
  options,
);
campToggle.addEventListener(
  "click",
  () => setCampOpen(campPanel.classList.contains("collapsed")),
  options,
);
element("#home-btn").addEventListener(
  "click",
  () => game.returnHome(),
  options,
);
element("#zoom-in-btn").addEventListener(
  "click",
  () => game.changeZoom(0.15),
  options,
);
element("#zoom-out-btn").addEventListener(
  "click",
  () => game.changeZoom(-0.15),
  options,
);
const soundButton = element("#sound-btn");
soundButton.addEventListener(
  "click",
  async () => {
    try {
      const enabled = await game.toggleSound();
      soundButton.setAttribute("aria-pressed", String(enabled));
      soundButton.setAttribute(
        "aria-label",
        enabled ? "효과음 끄기" : "효과음 켜기",
      );
      soundButton.title = enabled ? "효과음 끄기" : "효과음 켜기";
    } catch {
      soundButton.title = "이 브라우저에서 효과음을 시작할 수 없습니다.";
    }
  },
  options,
);
element("#info-panel").addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      closeButton.focus();
    }
  },
  options,
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    events.abort();
    closeButton.removeEventListener("click", closePanel);
    game.dispose();
  });
}
