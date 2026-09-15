# 쿼터뷰 3D 방치형 채집·사냥 게임 설계서

가제: **「Lumber & Hunt」** (웹 브라우저 3D 인크리멘탈 게임)

---

## 1. 게임 개요

| 항목 | 내용 |
|---|---|
| 장르 | 쿼터뷰 3D 액션 + 방치형(Idle/Incremental) + 자동화 시뮬레이션 |
| 플랫폼 | 웹 브라우저(PC/모바일 반응형), 이후 PWA 래핑 |
| 세션 목표 | 첫 세션 15분 이상, 재방문율(D1) 40%↑, 평균 일 세션 3회 |
| 핵심 재미 | "직접 벤다 → 돈 번다 → 강해진다 → 기계가 대신 벤다 → 더 큰 숫자" 의 무한 루프 |
| 조작 | 마우스(클릭/드래그 이동), 터치 대응. 플레이어는 항상 무기를 휘두름(공격 버튼 없음) |
| 수익 | Google AdSense(페이지 배너) + Google H5 Games Ads(인터스티셜/리워드) |

### 1.1 한 줄 핵심 루프
```
[이동] → [근접 자동 채집/사냥] → [재화 획득] → [상점 판매 → 골드]
   ↑                                                    ↓
[새 지역 해금] ← [플랫폼 업그레이드 / 자동화 고용] ← [장비 강화]
```

---

## 2. 기술 스택 및 아키텍처

### 2.1 스택
```
렌더링      : Three.js (r16x) 또는 Babylon.js  → 권장: Three.js + WebGL2
빌드        : Vite + TypeScript
상태관리    : 자체 ECS(Entity-Component-System) + 이벤트 버스
물리/충돌   : 자체 2D 원형 충돌(쿼터뷰라 3D 물리 불필요, 성능↑)
경로탐색    : 그리드 기반 A* (NavGrid 32×32 셀/청크)
UI          : HTML/CSS 오버레이 (DOM UI, 광고 삽입 용이) + 일부 Canvas
저장        : localStorage(즉시) + IndexedDB(백업) + 선택적 클라우드(Firebase Auth/Firestore)
빅넘버      : break_infinity.js (1e308 초과 대응)
광고        : AdSense(디스플레이) + AdSense for Games / H5 Games Ads SDK(afg.js)
분석        : GA4 + 자체 이벤트 로깅
```

### 2.2 모듈 구조
```
src/
├─ core/
│  ├─ GameLoop.ts        // 고정 틱(20Hz 로직) + 가변 렌더
│  ├─ ECS/               // World, Entity, Component, System
│  ├─ EventBus.ts
│  └─ SaveManager.ts     // 직렬화, 버전 마이그레이션, 오프라인 계산
├─ world/
│  ├─ ChunkManager.ts    // 맵 청크 로딩/언로딩
│  ├─ Spawner.ts         // 나무/동물 리스폰
│  ├─ NavGrid.ts
│  └─ biomes/            // 초원, 숲, 설원, 화산, 심연...
├─ entities/
│  ├─ Player.ts
│  ├─ Tree.ts, Animal.ts
│  ├─ Machine.ts         // 대포, 석궁, 톱기계...
│  └─ Worker.ts          // 나무꾼, 사냥꾼, 운반꾼
├─ systems/
│  ├─ MovementSystem.ts
│  ├─ AutoAttackSystem.ts
│  ├─ HarvestSystem.ts
│  ├─ EconomySystem.ts
│  ├─ UpgradeSystem.ts
│  ├─ AutomationSystem.ts
│  └─ OfflineProgressSystem.ts
├─ ui/
│  ├─ HUD.ts, ShopPanel.ts, ForgePanel.ts, PlatformPanel.ts
│  └─ AdManager.ts
├─ data/                 // 밸런스 테이블(JSON)
│  ├─ trees.json, animals.json, weapons.json, machines.json, workers.json
└─ render/
   ├─ CameraRig.ts       // 쿼터뷰 카메라
   ├─ InstancedRenderer.ts
   └─ VFX.ts
```

### 2.3 게임 루프
```ts
// 로직 20Hz 고정, 렌더는 rAF
const TICK = 1 / 20;
let acc = 0, last = performance.now();

function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25); // 탭 전환 시 스파이럴 방지
  last = now;
  while (acc >= TICK) { world.update(TICK); acc -= TICK; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
```

---

## 3. 카메라 & 조작

### 3.1 쿼터뷰 카메라
```ts
// 고정 각도 직교(Orthographic) 카메라 – 클래식 쿼터뷰 느낌
camera = new THREE.OrthographicCamera(-w, w, h, -h, 0.1, 500);
camera.position.set(target.x + 30, target.y + 40, target.z + 30); // 45° 회전, 약 53° 내려봄
camera.lookAt(target);
// 줌: 마우스 휠로 orthographic zoom 0.7~1.6 범위
// 플레이어 추적: lerp(camera.target, player.pos, 0.1)
```
- 회전 없음(고정 방향) → 조작 학습 비용 0
- 원근감을 위해 PerspectiveCamera(FOV 25°)도 옵션으로 제공

### 3.2 마우스 조작 스펙
| 입력 | 동작 |
|---|---|
| 좌클릭(지면) | 해당 지점으로 이동(A*). 이동 중 마커 표시 |
| 좌클릭 홀드 | 커서 방향으로 연속 이동(드래그 조이스틱 방식) |
| 좌클릭(나무/동물) | 대상까지 이동 후 사거리 내에서 자동 정지 → 자동 타격 |
| 우클릭 | 이동 취소 / 컨텍스트(기계 배치 모드에서는 회전) |
| 휠 | 줌 |
| Space | 상점/기지 텔레포트(해금 후) |
| 모바일 | 터치 = 좌클릭, 두 손가락 = 줌 |

### 3.3 자동 공격
플레이어는 **항상 무기를 휘두름**(idle 상태에서도 느린 스윙 애니메이션).
```
매 스윙(무기 attackSpeed 간격)마다:
  플레이어 전방 반경 R(=weapon.range, 기본 2.0m), 각도 120° 콘 안의
  Harvestable 컴포넌트를 가진 엔티티 전부에 damage 적용 (다중 히트)
  → 나무: 목재 HP 감소 / 동물: 생명 HP 감소
```
- 이동 중에는 스윙 속도 -30% (이동 중 공격 가능해야 답답하지 않음)
- 자동 타겟팅: 근처에 대상이 있으면 캐릭터가 그 방향으로 자동 회전

---

## 4. 월드 설계

### 4.1 맵 구조
- 중앙 **기지(Platform)**: 상점, 대장간, 창고, 기계 배치 구역
- 기지에서 방사형으로 **바이옴 링** 확장 (골드로 "영토 확장" 구매)
- 각 링은 청크(16×16m) 단위로 생성, 시드 기반 절차 생성(재접속 시 동일)

```
링 0 : 기지 (반경 12m)
링 1 : 초원   – 소나무, 토끼, 닭          (시작)
링 2 : 숲     – 참나무, 사슴, 멧돼지       (1,000 G)
링 3 : 습지   – 버드나무, 악어, 개구리     (25,000 G)
링 4 : 설원   – 자작나무, 늑대, 곰         (500k G)
링 5 : 화산   – 흑단목, 용암도마뱀, 드레이크(20M G)
링 6 : 심연   – 세계수 뿌리, 그림자짐승    (1B G)   ← 프레스티지 소재
링 7+: 무한 스케일 (절차적 등급 n, 수치 ×8^n)
```

### 4.2 자원 노드 정의(trees.json 예시)
```json
{
  "id": "oak",
  "name": "참나무",
  "biome": "forest",
  "hp": 120,
  "respawnSec": 45,
  "drops": [
    { "item": "wood_oak", "min": 3, "max": 5, "chance": 1.0 },
    { "item": "acorn",    "min": 1, "max": 1, "chance": 0.15 },
    { "item": "amber",    "min": 1, "max": 1, "chance": 0.01 }
  ],
  "requiredTier": 1,
  "model": "tree_oak.glb",
  "hitVfx": "wood_chips",
  "fallAnim": true
}
```

### 4.3 동물 정의(animals.json 예시)
```json
{
  "id": "boar",
  "name": "멧돼지",
  "biome": "forest",
  "hp": 200,
  "damage": 4,           // 플레이어에게 반격 (초기엔 미미, 후반 위협)
  "speed": 3.2,
  "behavior": "aggressive", // passive | flee | aggressive
  "aggroRange": 5,
  "respawnSec": 60,
  "drops": [
    { "item": "meat_boar", "min": 2, "max": 4, "chance": 1.0 },
    { "item": "hide",      "min": 1, "max": 2, "chance": 0.6 },
    { "item": "tusk",      "min": 1, "max": 1, "chance": 0.08 }
  ]
}
```
- 동물 AI: FSM(Idle → Wander → Flee/Chase → Attack → Dead)
- 플레이어 HP 존재하지만 사망 시 페널티는 "기지로 귀환 + 5초 대기"만 (스트레스 최소화)

---

## 5. 플레이어 & 장비

### 5.1 플레이어 스탯
```
damage        : 무기 기본 + 강화 보너스
attackSpeed   : 스윙/초 (기본 1.0)
range         : 타격 반경
moveSpeed     : 이동속도 (기본 4.5 m/s)
carryCapacity : 인벤토리 무게 한도 (초기 50 → 창고 업그레이드)
critChance / critMult
multiHit      : 한 스윙에 최대 타격 대상 수 (기본 1 → 도끼 계열 3, 대검 5)
luck          : 희귀 드롭 확률 배수
```

### 5.2 장비 슬롯
| 슬롯 | 효과 축 |
|---|---|
| 무기 (도끼/검/창/대검) | 데미지, 사거리, 다중타격. 도끼는 나무 +50%, 검은 동물 +50% |
| 방어구 | HP, 피격 감소, 이동속도 |
| 장갑 | 공격속도, 크리 확률 |
| 부츠 | 이동속도, 채집 속도 |
| 가방 | 적재량 |
| 부적 | 행운, 골드 획득 배수 |

### 5.3 강화 시스템 (핵심 골드 소비처)
```
강화 레벨 L (0 → 무한)
비용(L)   = base × 1.15^L            // 인크리멘탈 표준 지수
효과(L)   = base × (1 + 0.08L)        // 선형, 단 10레벨마다 ×1.5 마일스톤
성공률    = L  8 * 60_000
        && now - this.lastInterstitial > 4 * 60_000
        && this.count  game.pause(),
      afterAd:  () => game.resume(),
    });
    this.lastInterstitial = Date.now(); this.count++;
    analytics.log('ad_interstitial', { reason });
  }

  showRewarded(rewardId: string, onReward: () => void) {
    adBreak({
      type: 'reward',
      name: rewardId,
      beforeReward: (showAdFn) => showAdFn(),
      adViewed: () => { onReward(); analytics.log('ad_reward_done', { rewardId }); },
      adDismissed: () => ui.toast('광고를 끝까지 봐야 보상을 받을 수 있어요'),
    });
  }
}
```

### 9.5 예상 KPI(초기 목표)
```
DAU당 인터스티셜 3.5회, 리워드 2.0회
eCPM: 배너 $1~2, 인터스티셜 $5~10, 리워드 $12~20 (지역별 편차 큼)
ARPDAU 목표: $0.06~0.12
D1 40% / D7 18% / D30 7%
```

---

## 10. 밸런싱 수식 총정리

```
강화 비용         C(L) = C0 × 1.15^L
노동자 고용 비용  W(n) = W0 × 1.25^n
플랫폼 비용       P(k) = 5000 × 16^(k-2)
바이옴 자원 HP    HP(ring) = 50 × 6^ring
바이옴 드롭 가치  V(ring) = 5 × 7^ring         // HP보다 가치가 빨리 늘어 진출 유도
플레이어 DPS      D = dmg × aps × (1 + crit×(critMult-1)) × multiHit
자동화 DPS 총합   A = Σ workers + Σ machines
"방치 비율"       A / (A + D)  → 1시간 0.3, 1일 0.8, 1주 0.95 목표
오프라인 수익     A × t × 0.5 (정수 트리로 0.5 → 1.0)
정수              E = floor((totalGold / 1e8)^0.5)
```

밸런스 검증: 헤드리스 시뮬레이터(`npm run sim`)로 "최적 플레이 봇" 1주 가상 진행 → 병목 지점(30분 이상 구매 불가 구간) 자동 리포트.

---

## 11. 데이터 & 저장

### 11.1 세이브 스키마
```ts
interface SaveV1 {
  version: 1;
  lastSave: number;
  player: { pos: [number, number, number]; hp: number; equipment: Record };
  inventory: Record;      // break_infinity 문자열
  gold: string; gems: number; essence: number;
  platform: { level: number; slots: Array };
  workers: Array;
  fieldAnchors: Record }>;
  unlockedRings: number;
  world: { seed: number; nodeStates: Record };
  progress: { achievements: string[]; codex: string[]; daily: DailyState; streak: number };
  prestige: { count: number; tree: Record; totalGoldAllTime: string };
  settings: { volume: number; quality: 'low' | 'mid' | 'high'; autoSell: boolean };
}
```
- 30초 자동 저장 + 중요 이벤트 즉시 저장 + `beforeunload`
- 세이브 내보내기/불러오기(Base64) → 브라우저 이전 시 이탈 방지
- 치트 방지: 클라 게임이므로 완전 차단 불가. 랭킹 미도입으로 필요성 최소화, 세이브 CRC만 체크.

---

## 12. 성능 목표 & 최적화
```
목표: 중급 노트북 60fps, 모바일 30fps, 초기 로드 < 3MB(gzip)
- InstancedMesh: 나무/풀/돌 → 청크당 드로우콜 5개 이하
- 노동자/동물: 스켈레탈 애니메이션 대신 버텍스 애니메이션 텍스처(VAT) 또는 저폴리 + 8프레임 스텝 애니
- LOD 3단계, 카메라 밖 청크 로직 저빈도 갱신(1Hz)
- 필드 기계/노동자 100+ 개체 시: 시야 밖 개체는 "통계 모드"(초당 생산량만 합산, 렌더/AI 생략)
- 로우폴리 플랫 셰이딩 아트 → 에셋 용량↓, 시인성↑, 쿼터뷰에 최적
- 저사양 토글: 그림자 OFF, 파티클 50%
```

---

## 13. UI 레이아웃 (쿼터뷰 화면 기준)
```
┌──────────────────────────────────────────────────────────────┐
│ [골드 1.24M] [보석 45] [목재 3.2k] [고기 980]    [⚙][🔊][📖]   │ ← 상단 HUD
│                                                  ┌──────────┐│
│                                                  │ 다음 목표 ││
│              3D 게임 뷰 (쿼터뷰)                  │ ▸ 도끼 12강││
│                                                  │   ETA 2m ││
│                                                  │ ▸ 나무꾼#4││
│                                                  │ ▸ 플랫폼3 ││
│                                                  └──────────┘│
│ [⚡×2 부스트(광고)]                    [기지][대장간][고용][지도]│ ← 하단 바
├──────────────────────────────────────────────────────────────┤
│                 AdSense 반응형 배너 (게임 영역 외부)             │
└──────────────────────────────────────────────────────────────┘
```
모바일: 하단 바를 탭 아이콘으로, 배너는 하단 고정(게임 캔버스와 겹치지 않게).

---

## 14. 온보딩(첫 5분) 시나리오
```
0:00  기지에 서 있음. 말풍선: "저 나무를 클릭해봐!" (화살표 UI)
0:10  나무 3방에 넘어짐, 통나무 튐, 목재 +3 → 인벤 아이콘 반짝
0:30  "가방이 찼어! 상인에게 팔자" → 기지 자동 이동 → [판매] 버튼 클릭 → 코인 연출
0:45  대장간 강조: "도끼를 1강 해보자" (비용 10G, 100% 성공) → 데미지 상승 체감(2방에 넘어짐)
1:30  토끼 등장 → 자동 타격으로 고기 획득 → "고기는 비싸게 팔려!"
3:00  골드 300 달성 → "나무꾼을 고용할 수 있어!" (첫 나무꾼 특별가) → 나무꾼이 걸어가 나무 베는 모습
4:00  튜토리얼 종료, 일일 퀘스트 오픈, 다음 목표 패널 활성화
8:00  이후부터 인터스티셜 허용
```

---

## 15. 개발 로드맵 (1인~3인 기준)

| 단계 | 기간 | 산출물 |
|---|---|---|
| M0 프로토타입 | 2주 | 쿼터뷰 카메라, 클릭 이동, 나무 베기, 판매, 강화 1종. **손맛 검증** |
| M1 코어 루프 | 4주 | 동물 AI, 링 1~3, 장비 6슬롯, 플랫폼 Lv1~3, 나무꾼/석궁탑, 저장 |
| M2 자동화 | 4주 | 전 기계/노동자, 필드 앵커, 운반꾼, 오프라인 진행, 밸런스 시뮬레이터 |
| M3 리텐션 | 3주 | 일일 퀘스트, 출석, 도감, 업적, 프레스티지, 주간 보스 |
| M4 수익화 | 2주 | AdSense 승인, H5 Games Ads 연동, AdManager 규칙, GA4 이벤트 |
| M5 소프트런치 | 2주 | itch.io / 자체 도메인 배포, 퍼널 분석, 밸런스 패치 |
| M6 라이브 | 지속 | 시즌 이벤트, 링 7+, 스킨, PWA/앱 래핑 |

---

## 16. 리스크 & 대응
| 리스크 | 대응 |
|---|---|
| 수동 채집 지루함 | 5분 내 첫 자동화 노출, 다중타격·연쇄 넘어짐 연출로 손맛 확보 |
| 후반 숫자 인플레로 의미 상실 | 프레스티지 정수 트리에 "새 메커닉 해금"(마법 포탑, 시장 조작) 배치 |
| 광고 과다로 이탈 | 8분 유예·4분 간격·휴지점 규칙, 리워드 중심 수익 구조 |
| 모바일 성능 | 통계 모드, VAT 애니, 저사양 토글 |
| AdSense 정책(게임 내 광고 삽입 제한) | 디스플레이 배너는 캔버스 외부 DOM에, 게임 내 전면/리워드는 H5 Games Ads(AdSense for Games)로 분리 |

---