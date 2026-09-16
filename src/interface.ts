import { icon } from "./icons.ts";

const card = (id: string) =>
  `<button id="${id}" class="upgrade-card"></button>`;
const control = (id: string, name: string, label: string) =>
  `<button id="${id}" class="icon-button" title="${label}" aria-label="${label}">${icon(name)}</button>`;

export function createInterface() {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <div id="canvas-holder" aria-label="숲속 개척지. 땅을 클릭하거나 왼쪽 버튼을 누른 채 움직여 이동하고, 나무나 동물을 클릭해 채집합니다."></div>
    <div class="world-vignette"></div><div id="resource-bars"></div><div id="floating-labels" aria-hidden="true"></div>
    <div id="loading-screen"><div class="loading-emblem">${icon("tree")}</div><p class="eyebrow">YOUR NEXT LITTLE ADVENTURE</p><h1>Lumber <i>&amp;</i> Hunt</h1><p id="loading-message">숲이 깨어나고 있습니다…</p><div class="loading-track"><span></span></div></div>
    <div id="hud">
      <header class="topbar"><div class="brand"><div class="brand-mark">${icon("axe")}</div><div><span class="eyebrow">THE WILDS ARE CALLING</span><h1>Lumber <i>&amp;</i> Hunt</h1></div></div>
        <div class="resource-bar">${[
          ["gold", "coin", "골드"],
          ["wood", "wood", "목재"],
          ["meat", "meat", "고기"],
        ]
          .map(
            ([id, glyph, label]) =>
              `<div class="resource ${id}">${icon(glyph)}<div><small>${label}</small><strong id="hud-${id}">0</strong></div></div>`,
          )
          .join(
            "",
          )}<button id="sound-btn" class="icon-button" aria-label="효과음 켜기" aria-pressed="false" title="효과음 켜기">${icon("sound")}</button></div>
      </header>
      <section class="region-card"><span class="region-line"></span><div><p class="eyebrow" id="region-chapter">CHAPTER 01 · GREENWOOD</p><h2 id="region-name">초록빛 개척지</h2><p><span class="live-dot"></span> <span id="region-mood">평화로운 숲</span> <span class="region-divider">/</span> <span id="region-progress">탐험을 시작하세요</span></p></div></section>
      <aside class="camp-panel" id="camp-panel"><div class="panel-heading"><div><p class="eyebrow">MAKE YOURSELF AT HOME</p><h2>나의 개척지 <span id="camp-level">Lv.1</span></h2></div><span class="camp-seal">${icon("camp")}</span></div>
        <div class="panel-tabs" role="tablist" aria-label="개척지 메뉴">${[
          ["equipment", "장비"],
          ["companions", "동료"],
          ["automation", "자동"],
          ["territory", "개척"],
        ]
          .map(
            ([id, label], i) =>
              `<button class="${i === 0 ? "active" : ""}" id="tab-${id}" role="tab" aria-controls="pane-${id}" aria-selected="${i === 0}" data-tab="${id}">${label}</button>`,
          )
          .join("")}</div>
        <div id="pane-equipment" class="tab-pane" role="tabpanel" aria-labelledby="tab-equipment"><p class="section-caption">좋은 도구가 만드는 작은 차이</p>${["weapon", "armor", "gloves", "boots"].map((id) => card(`upgrade-${id}-btn`)).join("")}</div>
        <div id="pane-companions" class="tab-pane" role="tabpanel" aria-labelledby="tab-companions" hidden><p class="section-caption">함께하면 숲은 더 넓어집니다 <span id="slot-count">0 / 6</span></p>${["hire", "tower", "carrier", "anchor"].map((id) => card(`${id}-btn`)).join("")}</div>
        <div id="pane-automation" class="tab-pane auto-pane" role="tabpanel" aria-labelledby="tab-automation" hidden><p class="section-caption">플레이 방식 <span id="auto-mode-status">수동</span></p><div class="auto-mode-options" role="group" aria-label="자동 모드 선택"><button id="auto-mode-off" type="button"><strong>수동</strong><small>직접 탐험</small></button><button id="auto-mode-earn" type="button"><strong>골드 수집</strong><small>채집 · 판매</small></button><button id="auto-mode-grow" type="button"><strong>자동 성장</strong><small>채집 · 판매 · 구매</small></button></div><p id="auto-mode-description" class="auto-mode-description">직접 이동하고 채집합니다</p><div class="auto-mode-guide"><strong>자동 모드 안내</strong><p>가장 가까운 자원을 찾아 이동하고 채집합니다.</p><p>자동 성장은 장비·동료·영토를 낮은 비용부터 구매합니다.</p><p>프레스티지와 앵커 위치는 직접 결정합니다.</p></div></div>
        <div id="pane-territory" class="tab-pane" role="tabpanel" aria-labelledby="tab-territory" hidden><p class="section-caption">다음 모험을 위한 한 걸음</p>${["expand", "platform", "prestige"].map((id) => card(`${id}-btn`)).join("")}</div>
        <div class="trade-box"><div>${icon("cart")}<div><strong>오늘의 교역</strong><small id="trade-prices">목재 2G · 고기 5G</small></div></div><button id="sell-btn">모두 판매 ${icon("arrow")}</button></div><div class="camp-note"><span class="live-dot"></span> <span id="save-status">진행 상황 자동 저장</span></div>
      </aside>
      <section class="quest-card"><div class="quest-icon">${icon("flag")}</div><div><p class="eyebrow">작은 목표, 새로운 시작</p><h3 id="quest-title">첫 번째 나무를 베어보세요</h3><p id="quest-description">나무를 클릭하면 다가가서 자동으로 채집해요.</p><div class="quest-track"><span id="quest-fill"></span></div></div></section>
      <footer class="bottom-bar"><div class="player-card"><div class="portrait">${icon("axe")}</div><div><div class="player-name">숲의 개척자 <span>EXPLORER</span></div><div class="health-row">${icon("heart")}<div class="health-track"><span id="health-fill"></span></div><span id="hud-hp">100 / 100</span></div></div></div>
        <nav class="journal-nav" aria-label="게임 메뉴"><button id="codex-btn"></button><button id="achievements-btn"></button><button id="camp-toggle-btn" aria-expanded="true" aria-controls="camp-panel">${icon("camp")}<span>개척지</span></button></nav>
        <div class="camera-controls">${control("home-btn", "home", "기지로 귀환 (H)")}<span></span>${control("zoom-out-btn", "minus", "축소")}${control("zoom-in-btn", "plus", "확대")}</div>
      </footer><div class="control-hint"><span>클릭 / 홀드</span> 이동 · 채집 <b>·</b> <span>휠</span> 확대 / 축소 <b>·</b> <span>ESC</span> 취소</div>
    </div>
    <div id="target-card" hidden><span id="target-name"></span><span id="target-hp"></span><div><i id="target-health-fill"></i></div></div>
    <div id="offline-banner" role="status" hidden></div>
    <div id="info-panel" role="dialog" aria-modal="true" aria-labelledby="info-panel-title" hidden><div id="info-panel-header"><div><p class="eyebrow">THE EXPLORER'S JOURNAL</p><h2 id="info-panel-title"></h2></div>${control("info-panel-close", "close", "닫기")}</div><div id="info-panel-body"></div></div>`;
}
