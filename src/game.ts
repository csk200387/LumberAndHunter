import * as THREE from "three";
import type {
  State,
  Species,
  EquipSlot,
  Harvestable,
  WorkerUnit,
  TowerUnit,
  CarrierUnit,
} from "./types.ts";
import {
  TICK,
  MOVE_SPEED,
  ATTACK_RANGE,
  EQUIP_SLOTS,
  WOOD_SELL_PRICE,
  MEAT_SELL_PRICE,
  ANIMAL_WANDER_RADIUS,
  PLAYER_MAX_HP,
  DEATH_STUN_MS,
  SAVE_INTERVAL_MS,
  WORKER_DAMAGE,
  WORKER_ATTACK_INTERVAL,
  WORKER_SPEED,
  TOWER_DAMAGE,
  TOWER_ATTACK_INTERVAL,
  TOWER_RANGE,
  PLATFORM_MAX_LEVEL,
  platformUpgradeCost,
  ANCHOR_COST,
  ANCHOR_CAPACITY,
  CARRIER_SPEED,
  CARRIER_CARRY_CAPACITY,
  ARRIVE_DIST,
  PRESTIGE_ARM_MS,
  SPECIES_NAME,
  SPECIES,
  RING_COST,
  RING_BAND,
} from "./balance.ts";
import { ModelLibrary, disposeObjects } from "./models.ts";
import { Hud, type HudElements } from "./hud.ts";
import { Scenery, seededRandom } from "./scenery.ts";
import { Effects } from "./effects.ts";
import { GameAudio } from "./audio.ts";
import { PlayerMotion } from "./player-motion.ts";
import { ResourceBars } from "./resource-bars.ts";
import { createDefaultState, loadState, saveState } from "./state.ts";
import * as economy from "./economy.ts";
import {
  applyDailyLogin,
  applyOfflineProgress,
  claimAchievements,
  resetRun,
} from "./progression.ts";

export class Game {
  private scene = new THREE.Scene();
  private scenery: Scenery;
  private effects: Effects;
  private audio = new GameAudio();
  private playerMotion = new PlayerMotion();
  private resourceBars: ResourceBars;
  private cameraFocus = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(26, 34, 26);
  private zoom = 1.12;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private raycaster = new THREE.Raycaster();
  private ground: THREE.Mesh;
  private player: THREE.Group;
  private models = new ModelLibrary();
  private harvestables: Harvestable[] = [];
  private workers: WorkerUnit[] = [];
  private towers: TowerUnit[] = [];
  private carriers: CarrierUnit[] = [];
  private anchor: THREE.Group | null = null;
  private placingAnchor = false;
  private prestigeArmed = false;
  private prestigeTimer = 0;
  private ready = false;
  private disposed = false;
  private events = new AbortController();
  private saveTimer = 0;
  private frameId = 0;

  private moveTarget: THREE.Vector3 | null = null;
  private target: Harvestable | null = null;
  private attackTimer = 0;

  private playerHp = PLAYER_MAX_HP;
  private stunnedUntil = 0;

  private state: State = createDefaultState();

  private hud: HudElements;
  private view: Hud;

  constructor(container: HTMLElement, hud: HudElements) {
    this.hud = hud;
    this.view = new Hud(hud, () => this.state);
    this.state = loadState();
    this.playerHp = economy.maxHp(this.state);
    this.applyOfflineProgress();
    this.applyDailyLogin();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    const d = window.innerWidth < 761 ? 17 : 15.5;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      0.1,
      500,
    );
    this.camera.position.set(30, 40, 30);
    this.camera.lookAt(0, 0, 0);

    this.scenery = new Scenery(this.scene, this.state.unlockedRing);
    this.ground = this.scenery.ground;
    this.effects = new Effects(
      this.scene,
      container.ownerDocument.getElementById("floating-labels")!,
    );

    this.resourceBars = new ResourceBars(
      container.ownerDocument.getElementById("resource-bars")!,
    );

    this.player = new THREE.Group(); // replaced with the real model once init() loads it
    this.scene.add(this.player);
    void this.init().catch((error: unknown) => {
      if (this.disposed) return;
      console.error("게임 모델 로딩 실패", error);
      this.view.loading(
        "숲을 불러오지 못했습니다. 새로고침해 다시 시도해 주세요.",
      );
      this.view.showToast(
        "모델을 불러오지 못했습니다. 새로고침해 다시 시도해 주세요.",
        30000,
      );
    });

    const options = { signal: this.events.signal };
    const bindAction = (button: HTMLButtonElement, action: () => void) => {
      button.addEventListener(
        "click",
        () => {
          if (!this.ready) return;
          const beforeGold = this.state.gold;
          action();
          if (this.state.gold !== beforeGold) this.audio.purchase();
          this.saveState();
        },
        options,
      );
    };
    this.renderer.domElement.addEventListener(
      "click",
      (e) => this.onClick(e),
      options,
    );
    window.addEventListener("resize", () => this.onResize(), options);
    this.renderer.domElement.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.changeZoom(event.deltaY > 0 ? -0.08 : 0.08);
      },
      { ...options, passive: false },
    );
    this.renderer.domElement.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
        this.cancelAction();
      },
      options,
    );
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          this.cancelAction();
          this.view.closePanel();
        }
        if (event.key.toLowerCase() === "h" && this.hud.infoPanel.hidden)
          this.returnHome();
      },
      options,
    );
    this.onResize();

    bindAction(this.hud.sellBtn, () => this.sellAll());
    for (const slot of EQUIP_SLOTS) {
      bindAction(this.hud.upgradeBtns[slot], () => this.buyUpgrade(slot));
    }
    bindAction(this.hud.expandBtn, () => this.buyRingExpansion());
    bindAction(this.hud.hireBtn, () => this.hireWorker());
    bindAction(this.hud.towerBtn, () => this.buildTower());
    bindAction(this.hud.platformBtn, () => this.upgradePlatform());
    bindAction(this.hud.anchorBtn, () => this.startPlacingAnchor());
    bindAction(this.hud.carrierBtn, () => this.hireCarrier());
    bindAction(this.hud.prestigeBtn, () => this.clickPrestige());
    bindAction(this.hud.codexBtn, () => this.view.togglePanel("codex"));
    bindAction(this.hud.achievementsBtn, () =>
      this.view.togglePanel("achievements"),
    );
    this.updateHud();

    this.saveState();
    this.saveTimer = window.setInterval(
      () => this.saveState(),
      SAVE_INTERVAL_MS,
    );
    window.addEventListener("pagehide", () => this.saveState(), options);

    this.loop();
  }

  private async init() {
    await this.models.load();
    if (this.disposed) {
      this.models.dispose();
      return;
    }

    this.scenery.decorate(this.models);
    const playerModel = this.models.instance("player");
    this.scene.remove(this.player);
    this.player = playerModel;
    this.scene.add(this.player);
    this.player.position.set(1, 0, 3);
    this.playerMotion.reset(this.player);

    for (let ring = 1; ring <= this.state.unlockedRing; ring++) {
      this.populateRing(ring);
    }

    for (let i = 0; i < this.state.workerCount; i++) {
      this.spawnWorker(i);
    }
    for (let i = 0; i < this.state.towerCount; i++) {
      this.spawnTower(i);
    }
    if (this.state.anchorPos) {
      this.buildAnchorAt(
        new THREE.Vector3(this.state.anchorPos[0], 0, this.state.anchorPos[1]),
      );
    }
    for (let i = 0; i < this.state.carrierCount; i++) {
      this.spawnCarrier(i);
    }
    this.ready = true;
    this.view.loading();
    this.updateHud();
    this.saveState();
  }

  private populateRing(ring: number) {
    const [rMin, rMax] = RING_BAND[ring];
    const random = seededRandom(1287 + ring);
    const speciesForRing = (Object.keys(SPECIES) as Species[]).filter(
      (s) => SPECIES[s].ring === ring,
    );
    const countPer = { tree: 16, animal: 5 } as const;

    for (const species of speciesForRing) {
      const count = countPer[SPECIES[species].kind];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + random() * 0.35;
        const radius = rMin + random() * (rMax - rMin);
        this.spawn(
          species,
          new THREE.Vector3(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius,
          ),
        );
      }
    }
  }

  private buyRingExpansion() {
    const nextRing = this.state.unlockedRing + 1;
    const cost = RING_COST[nextRing];
    if (cost === undefined || this.state.gold < cost) return;
    this.state.gold -= cost;
    this.state.unlockedRing = nextRing;
    this.populateRing(nextRing);
    this.updateHud();
  }

  private saveState() {
    const saved = saveState(undefined, this.state);
    const status = this.hud.gold.ownerDocument?.getElementById("save-status");
    if (status)
      status.textContent = saved
        ? "진행 상황 자동 저장"
        : "저장 공간을 확인해 주세요";
  }

  private applyOfflineProgress() {
    const { seconds, wood, meat } = applyOfflineProgress(this.state);
    if (wood <= 0 && meat <= 0) return;
    const mins = Math.round(seconds / 60);
    const timeLabel =
      mins < 60 ? `${mins}분` : `${Math.floor(mins / 60)}시간 ${mins % 60}분`;
    this.view.showToast(
      `오프라인 ${timeLabel} 동안 목재 +${wood}, 고기 +${meat} 획득!`,
    );
  }

  private applyDailyLogin() {
    const reward = applyDailyLogin(this.state);
    if (reward > 0)
      this.view.showToast(
        `출석 ${this.state.loginStreak}일차! 골드 +${reward}`,
      );
  }

  private clickPrestige() {
    if (this.prestigeArmed) {
      this.doPrestige();
      return;
    }
    if (economy.essenceGainPreview(this.state) < 1) return;
    this.prestigeArmed = true;
    this.view.showToast(
      `정수 +${economy.essenceGainPreview(this.state)} 획득 후 초기화됩니다. 다시 누르면 확정`,
      PRESTIGE_ARM_MS,
    );
    this.updateHud();
    clearTimeout(this.prestigeTimer);
    this.prestigeTimer = window.setTimeout(() => {
      if (this.prestigeArmed) {
        this.prestigeArmed = false;
        this.updateHud();
      }
    }, PRESTIGE_ARM_MS);
  }

  private doPrestige() {
    const gain = economy.essenceGainPreview(this.state);
    if (gain < 1) return;

    this.effects.reset();
    this.resourceBars.clear();
    for (const unit of [
      ...this.workers,
      ...this.carriers,
      ...this.harvestables,
    ])
      this.models.release(unit.group);
    this.state = resetRun(this.state, gain);
    this.prestigeArmed = false;
    this.placingAnchor = false;
    this.attackTimer = 0;
    this.stunnedUntil = 0;
    clearTimeout(this.prestigeTimer);
    disposeObjects([
      ...this.towers.map((tower) => tower.group),
      ...(this.anchor ? [this.anchor] : []),
    ]);

    for (const w of this.workers) this.scene.remove(w.group);
    this.workers = [];
    for (const t of this.towers) this.scene.remove(t.group);
    this.towers = [];
    for (const c of this.carriers) this.scene.remove(c.group);
    this.carriers = [];
    if (this.anchor) {
      this.scene.remove(this.anchor);
      this.anchor = null;
    }
    for (const h of this.harvestables) this.scene.remove(h.group);
    this.harvestables = [];
    this.populateRing(1);

    this.player.position.set(0, 0, 0);
    this.playerHp = economy.maxHp(this.state);
    this.target = null;
    this.moveTarget = null;

    this.view.showToast(
      `프레스티지 완료! 정수 +${gain} (총 ${this.state.essence})`,
    );
    this.updateHud();
  }

  private spawn(species: Species, pos: THREE.Vector3) {
    const h = this.makeHarvestable(species, pos);
    this.scene.add(h.group);
    this.harvestables.push(h);
    this.resourceBars.add(h);
  }

  private spawnWorker(index: number) {
    const group = this.models.instance("worker");
    const angle = (index / 6) * Math.PI * 2;
    group.position.set(Math.cos(angle) * 3, 0, Math.sin(angle) * 3);
    this.scene.add(group);
    this.workers.push({ group, target: null, attackTimer: 0 });
  }

  private hireWorker() {
    const cost = economy.workerCost(this.state);
    if (
      this.state.gold < cost ||
      economy.automationCount(this.state) >=
        economy.maxAutomationSlots(this.state)
    )
      return;
    this.state.gold -= cost;
    this.spawnWorker(this.state.workerCount);
    this.state.workerCount++;
    this.updateHud();
  }

  private upgradePlatform() {
    const nextLevel = this.state.platformLevel + 1;
    if (nextLevel > PLATFORM_MAX_LEVEL) return;
    const cost = platformUpgradeCost(nextLevel);
    if (this.state.gold < cost) return;
    this.state.gold -= cost;
    this.state.platformLevel = nextLevel;
    this.updateHud();
  }

  private nearestHarvestable(
    pos: THREE.Vector3,
    kind: Harvestable["kind"],
    maxRange = Infinity,
  ): Harvestable | null {
    let best: Harvestable | null = null;
    let bestDistanceSquared = Infinity;
    const rangeSquared = maxRange * maxRange;
    for (const candidate of this.harvestables) {
      if (!candidate.alive || candidate.kind !== kind) continue;
      const distanceSquared = pos.distanceToSquared(candidate.group.position);
      if (
        distanceSquared <= rangeSquared &&
        distanceSquared < bestDistanceSquared
      ) {
        bestDistanceSquared = distanceSquared;
        best = candidate;
      }
    }
    return best;
  }

  private spawnTower(index: number) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x555555 }),
    );
    base.position.y = 0.7;
    const bow = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.15, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b }),
    );
    bow.position.y = 1.5;
    group.add(base, bow);
    const angle = (index / 6) * Math.PI * 2 + Math.PI; // opposite side from workers
    group.position.set(Math.cos(angle) * 3, 0, Math.sin(angle) * 3);
    this.scene.add(group);
    this.towers.push({ group, target: null, attackTimer: 0 });
  }

  private buildTower() {
    const cost = economy.towerCost(this.state);
    if (
      this.state.gold < cost ||
      economy.automationCount(this.state) >=
        economy.maxAutomationSlots(this.state)
    )
      return;
    this.state.gold -= cost;
    this.spawnTower(this.state.towerCount);
    this.state.towerCount++;
    this.updateHud();
  }

  private startPlacingAnchor() {
    if (this.anchor || this.state.gold < ANCHOR_COST || this.placingAnchor)
      return;
    this.placingAnchor = true;
    this.view.showToast("필드 앵커를 배치할 위치를 클릭하세요", 8000);
    this.updateHud();
  }

  private buildAnchorAt(pos: THREE.Vector3) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 2, 6),
      new THREE.MeshStandardMaterial({ color: 0x9a7b4f }),
    );
    pole.position.y = 1;
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.4, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xf2c744 }),
    );
    flag.position.set(0.3, 1.7, 0);
    group.add(pole, flag);
    group.position.copy(pos);
    group.position.y = 0;
    this.scene.add(group);
    this.anchor = group;
  }

  private spawnCarrier(index: number) {
    const group = this.models.instance("carrier");
    const angle = (index / 6) * Math.PI * 2 + Math.PI / 2; // third spoke, away from workers/towers
    group.position.set(Math.cos(angle) * 3, 0, Math.sin(angle) * 3);
    this.scene.add(group);
    this.carriers.push({ group, carrying: 0 });
  }

  private hireCarrier() {
    const cost = economy.carrierCost(this.state);
    if (
      !this.anchor ||
      this.state.gold < cost ||
      economy.automationCount(this.state) >=
        economy.maxAutomationSlots(this.state)
    )
      return;
    this.state.gold -= cost;
    this.spawnCarrier(this.state.carrierCount);
    this.state.carrierCount++;
    this.updateHud();
  }

  private makeHarvestable(species: Species, pos: THREE.Vector3): Harvestable {
    const cfg = SPECIES[species];
    const group = this.models.instance(species);
    group.position.copy(pos);
    if (cfg.kind === "tree") {
      const variation = seededRandom(Math.round(pos.x * 97 + pos.z * 131));
      group.scale.multiplyScalar(0.9 + variation() * 0.25);
      group.rotation.y = variation() * Math.PI * 2;
    }

    return {
      group,
      species,
      kind: cfg.kind,
      hp: cfg.hp,
      maxHp: cfg.hp,
      alive: true,
      respawnAt: 0,
      home: pos.clone(),
      wanderTarget: null,
      nextWanderAt: 0,
      attackTimer: 0,
    };
  }

  private onResize() {
    const d = 20;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private onClick(e: MouseEvent) {
    if (
      !this.ready ||
      !this.hud.infoPanel.hidden ||
      performance.now() < this.stunnedUntil
    )
      return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    if (this.placingAnchor) {
      const groundHit = this.raycaster.intersectObject(this.ground)[0];
      if (groundHit && this.state.gold >= ANCHOR_COST) {
        this.state.gold -= ANCHOR_COST;
        this.placingAnchor = false;
        this.buildAnchorAt(groundHit.point);
        this.state.anchorPos = [groundHit.point.x, groundHit.point.z];
        this.view.showToast("필드 앵커를 배치했습니다!");
        this.updateHud();
        this.saveState();
      }
      return;
    }

    const liveMeshes = this.harvestables
      .filter((h) => h.alive)
      .map((h) => h.group);
    const hit = this.raycaster.intersectObjects(liveMeshes, true)[0];
    if (hit) {
      // glTF models nest meshes several levels deep, so walk up to the harvestable's root group
      let node: THREE.Object3D | null = hit.object;
      while (node && !liveMeshes.some((g) => g === node)) node = node.parent;
      const target = this.harvestables.find((h) => h.group === node);
      if (target) {
        this.target = target;
        this.attackTimer = 0;
        this.moveTarget = target.group.position.clone();
        return;
      }
    }

    const groundHit = this.raycaster.intersectObject(this.ground)[0];
    if (groundHit) {
      this.target = null;
      this.moveTarget = groundHit.point.clone();
      this.effects?.move(this.moveTarget);
    }
  }

  private sellAll() {
    if (this.state.wood <= 0 && this.state.meat <= 0) return;
    const raw =
      this.state.wood * WOOD_SELL_PRICE + this.state.meat * MEAT_SELL_PRICE;
    const earned = Math.round(raw * economy.essenceSellMult(this.state));
    this.state.gold += earned;
    this.state.goldEarnedThisRun += earned;
    this.state.totalGoldAllTime += earned;
    this.effects?.label(
      `+${earned} 골드`,
      this.player.position.clone().add(new THREE.Vector3(0, 2.7, 0)),
    );
    this.view.showToast(`교역 완료 · ${earned} 골드를 받았습니다.`);
    this.state.wood = 0;
    this.state.meat = 0;
    this.updateHud();
  }

  private buyUpgrade(slot: EquipSlot) {
    const cost = economy.upgradeCost(this.state, slot);
    if (this.state.gold < cost) return;
    this.state.gold -= cost;
    this.state.upgrades[slot]++;
    if (slot === "armor") this.playerHp += 5; // top up so the new max feels like an immediate gain
    this.updateHud();
  }

  private updateHud() {
    for (const message of claimAchievements(this.state))
      this.view.showToast(message);
    this.view.render(
      this.state,
      this.playerHp,
      this.placingAnchor,
      this.prestigeArmed,
      this.ready,
    );
  }

  private update(dt: number) {
    if (!this.ready) return;
    const now = performance.now();

    if (now >= this.stunnedUntil) {
      if (this.target?.alive) {
        const distance = this.player.position.distanceTo(
          this.target.group.position,
        );
        if (distance > ATTACK_RANGE) {
          this.playerMotion.move(
            this.player,
            this.target.group.position,
            dt,
            economy.moveSpeed(this.state),
            ATTACK_RANGE - 0.02,
          );
        } else {
          this.playerMotion.stop();
          this.playerMotion.face(this.player, this.target.group.position, dt);
          this.attackTimer += dt;
          if (this.attackTimer >= economy.attackInterval(this.state)) {
            this.attackTimer = 0;
            this.models.strike(this.player);
            this.harvest(this.target, economy.currentDamage(this.state));
          }
        }
      } else if (this.moveTarget) {
        if (
          this.playerMotion.move(
            this.player,
            this.moveTarget,
            dt,
            economy.moveSpeed(this.state),
          )
        )
          this.moveTarget = null;
      } else this.playerMotion.stop();
    } else this.playerMotion.stop();

    for (const h of this.harvestables) {
      if (!h.alive) {
        if (now >= h.respawnAt) {
          h.alive = true;
          h.hp = h.maxHp;
          h.group.visible = true;
          h.group.position.copy(h.home);
          h.wanderTarget = null;
          h.nextWanderAt = 0;
          h.attackTimer = 0;
        }
        continue;
      }
      if (h.kind === "animal") {
        const cfg = SPECIES[h.species];
        if (cfg.aggressive) {
          this.aggro(h, dt, now);
        } else if (h !== this.target) {
          this.wander(h, dt, now);
        }
      }
    }

    for (const w of this.workers) {
      this.tickWorker(w, dt);
    }

    for (const t of this.towers) {
      this.tickTower(t, dt);
    }

    for (const c of this.carriers) {
      this.tickCarrier(c, dt);
    }
  }

  private tickCarrier(c: CarrierUnit, dt: number) {
    if (!this.anchor) return;

    if (c.carrying > 0) {
      this.moveTowards(new THREE.Vector3(0, 0, 0), dt, c.group, CARRIER_SPEED);
      if (c.group.position.length() <= ARRIVE_DIST) {
        this.state.wood += c.carrying;
        c.carrying = 0;
        this.updateHud();
      }
    } else {
      this.moveTowards(this.anchor.position, dt, c.group, CARRIER_SPEED);
      if (
        c.group.position.distanceTo(this.anchor.position) <= ARRIVE_DIST &&
        this.state.anchorStock > 0
      ) {
        const pickup = Math.min(CARRIER_CARRY_CAPACITY, this.state.anchorStock);
        this.state.anchorStock -= pickup;
        c.carrying = pickup;
        this.updateHud();
      }
    }
  }

  private tickTower(t: TowerUnit, dt: number) {
    if (
      !t.target?.alive ||
      t.group.position.distanceTo(t.target.group.position) > TOWER_RANGE
    ) {
      t.target = this.nearestHarvestable(
        t.group.position,
        "animal",
        TOWER_RANGE,
      );
    }
    if (!t.target) return; // nothing in range right now

    t.group.lookAt(
      t.target.group.position.x,
      t.group.position.y,
      t.target.group.position.z,
    );
    t.attackTimer += dt;
    if (t.attackTimer >= TOWER_ATTACK_INTERVAL) {
      t.attackTimer = 0;
      this.harvest(t.target, TOWER_DAMAGE);
    }
  }

  private tickWorker(w: WorkerUnit, dt: number) {
    if (!w.target?.alive) {
      w.target = this.nearestHarvestable(w.group.position, "tree");
    }
    if (!w.target) return; // no trees left to chop (shouldn't normally happen)

    const dist = w.group.position.distanceTo(w.target.group.position);
    if (dist > ATTACK_RANGE) {
      this.moveTowards(w.target.group.position, dt, w.group, WORKER_SPEED);
    } else {
      w.attackTimer += dt;
      if (w.attackTimer >= WORKER_ATTACK_INTERVAL) {
        w.attackTimer = 0;
        this.models.strike(w.group);
        this.harvest(w.target, WORKER_DAMAGE, true);
      }
    }
  }

  private aggro(h: Harvestable, dt: number, now: number) {
    const cfg = SPECIES[h.species];
    const distToPlayer = h.group.position.distanceTo(this.player.position);
    if (distToPlayer > (cfg.aggroRange ?? 0)) {
      this.wander(h, dt, now);
      return;
    }
    if (distToPlayer > ATTACK_RANGE) {
      this.moveTowards(this.player.position, dt, h.group, cfg.speed);
    } else {
      h.attackTimer += dt;
      if (h.attackTimer >= (cfg.attackInterval ?? 1)) {
        h.attackTimer = 0;
        this.damagePlayer(cfg.damage ?? 0);
      }
    }
  }

  private damagePlayer(amount: number) {
    if (performance.now() < this.stunnedUntil) return;
    this.playerHp -= amount;
    this.effects?.label(
      `−${amount}`,
      this.player.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
      "hurt",
    );
    if (this.playerHp <= 0) {
      this.playerHp = economy.maxHp(this.state);
      this.player.position.set(1, 0, 3);
      this.playerMotion.reset(this.player);
      this.target = null;
      this.moveTarget = null;
      this.stunnedUntil = performance.now() + DEATH_STUN_MS;
    }
    this.updateHud();
  }

  private wander(h: Harvestable, dt: number, now: number) {
    if (!h.wanderTarget && now >= h.nextWanderAt) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * ANIMAL_WANDER_RADIUS;
      h.wanderTarget = h.home
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius,
          ),
        );
    }
    if (h.wanderTarget) {
      const dist = h.group.position.distanceTo(h.wanderTarget);
      if (dist > 0.1) {
        this.moveTowards(
          h.wanderTarget,
          dt,
          h.group,
          SPECIES[h.species].speed ?? 1,
        );
      } else {
        h.wanderTarget = null;
        h.nextWanderAt = now + 2000 + Math.random() * 3000;
      }
    }
  }

  private moveTowards(
    target: THREE.Vector3,
    dt: number,
    mover: THREE.Object3D,
    speed = MOVE_SPEED,
  ) {
    const dir = target.clone().sub(mover.position);
    dir.y = 0;
    const dist = dir.length();
    const step = Math.min(dist, speed * dt);
    if (dist > 0.001) {
      dir.normalize();
      mover.position.addScaledVector(dir, step);
      mover.lookAt(mover.position.x + dir.x, 0, mover.position.z + dir.z);
    }
  }

  private harvest(h: Harvestable, damage: number, viaAnchor = false) {
    if (!h.alive) return;
    h.hp -= damage;
    this.effects?.hit(h, damage);
    this.audio?.hit(h.kind === "tree");
    if (h.hp <= 0) {
      const cfg = SPECIES[h.species];
      h.alive = false;
      this.effects?.burst(h.group.position, h.kind === "tree" ? 0 : 1);
      h.group.visible = false;
      this.effects?.fall(h);
      h.respawnAt = performance.now() + cfg.respawnSec * 1000;
      if (!this.state.discovered[h.species]) {
        this.state.discovered[h.species] = true;
        this.view.showToast(`도감 등록: ${SPECIES_NAME[h.species]}`);
      }
      if (h.kind === "tree") {
        const min = cfg.woodMin ?? 3;
        const max = cfg.woodMax ?? 5;
        const amount = min + Math.floor(Math.random() * (max - min + 1));
        this.effects?.label(
          `+${amount} 목재`,
          h.group.position.clone().add(new THREE.Vector3(0, 3.3, 0)),
        );
        if (viaAnchor && this.anchor) {
          this.state.anchorStock = Math.min(
            this.state.anchorStock + amount,
            ANCHOR_CAPACITY,
          );
        } else {
          this.state.wood += amount;
        }
      } else {
        const min = cfg.meatMin ?? 2;
        const max = cfg.meatMax ?? 4;
        const amount = min + Math.floor(Math.random() * (max - min + 1));
        this.state.meat += amount;
        this.effects?.label(
          `+${amount} 고기`,
          h.group.position.clone().add(new THREE.Vector3(0, 2, 0)),
        );
      }
      if (this.target === h) {
        this.target = null;
        this.moveTarget = null;
        this.attackTimer = 0;
      }
      this.updateHud();
    }
  }

  changeZoom(amount: number) {
    this.zoom = THREE.MathUtils.clamp(this.zoom + amount, 0.65, 1.7);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  }

  returnHome() {
    if (!this.ready) return;
    this.cancelAction();
    this.player.position.set(1, 0, 3);
    this.playerMotion.reset(this.player);
    this.view.showToast("야영지에 돌아왔습니다. 잠시 숨을 돌려보세요.");
  }

  cancelAction() {
    this.playerMotion.stop();
    this.target = null;
    this.moveTarget = null;
    this.placingAnchor = false;
    this.attackTimer = 0;
    this.updateHud();
  }

  async toggleSound() {
    return this.audio.toggle();
  }
  closeJournal() {
    this.view.closePanel();
  }

  dispose() {
    if (this.disposed) return;
    this.saveState();
    this.disposed = true;
    this.events.abort();
    clearInterval(this.saveTimer);
    clearTimeout(this.prestigeTimer);
    cancelAnimationFrame(this.frameId);
    this.view.dispose();
    this.effects.dispose();
    this.resourceBars.clear();
    this.audio.dispose();
    // Instances share template geometry/materials; dispose the whole set only once.
    const templates = this.models.templates();
    this.models.clear();
    disposeObjects([this.scene, ...templates]);
    this.scenery.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private acc = 0;
  private last = performance.now();
  private loop = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.25);
    this.acc += dt;
    this.last = now;
    while (this.acc >= TICK) {
      this.playerMotion.capture(this.player);
      this.update(TICK);
      this.acc -= TICK;
    }
    this.playerMotion.interpolate(this.player, this.acc / TICK);
    const targetFocus = this.player.position.clone();
    if (window.innerWidth > 760) targetFocus.add(new THREE.Vector3(4, 0, -4));
    this.cameraFocus.lerp(targetFocus, 1 - Math.exp(-dt * 2.5));
    this.camera.position.copy(this.cameraFocus).add(this.cameraOffset);
    this.camera.lookAt(this.cameraFocus);
    this.camera.updateMatrixWorld();
    this.scenery.update(
      now / 1000,
      this.state.unlockedRing,
      dt,
      Math.hypot(this.player.position.x, this.player.position.z),
    );
    this.models.setMotion(this.player, this.playerMotion.speed);
    this.models.update(dt, now / 1000);
    this.resourceBars.update(this.camera, this.target);
    this.effects.update(
      dt,
      now / 1000,
      this.camera,
      this.player,
      this.target,
      !!this.moveTarget,
    );
    this.view.target(this.target);
    this.renderer.render(this.scene, this.camera);
    this.playerMotion.restore(this.player);
    this.frameId = requestAnimationFrame(this.loop);
  };
}
