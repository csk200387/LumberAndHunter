import * as THREE from "three";
import { SPECIES_NAME } from "./balance.ts";
import type { Harvestable } from "./types.ts";

interface ResourceBar {
  element: HTMLDivElement;
  fill: HTMLSpanElement;
  height: number;
  hp: number;
}

/** Small screen-space bars, attached only to harvestable entities (never scenery). */
export class ResourceBars {
  private bars = new Map<Harvestable, ResourceBar>();
  private root: HTMLElement;
  private projected = new THREE.Vector3();

  constructor(root: HTMLElement) {
    this.root = root;
  }

  add(target: Harvestable) {
    if (this.bars.has(target)) return;
    const element = this.root.ownerDocument.createElement("div");
    element.className = `resource-health ${target.kind}`;
    element.setAttribute("role", "meter");
    element.setAttribute(
      "aria-label",
      `${target.displayName ?? SPECIES_NAME[target.species]} 체력`,
    );
    element.setAttribute("aria-valuemin", "0");
    element.setAttribute("aria-valuemax", String(target.maxHp));
    const fill = this.root.ownerDocument.createElement("span");
    element.appendChild(fill);
    this.root.appendChild(element);
    const bounds = new THREE.Box3().setFromObject(target.group);
    this.bars.set(target, {
      element,
      fill,
      height: Math.max(0.7, bounds.max.y - target.group.position.y) + 0.25,
      hp: -1,
    });
  }

  update(camera: THREE.Camera, selected: Harvestable | null) {
    const width = this.root.clientWidth,
      height = this.root.clientHeight;
    for (const [target, bar] of this.bars) {
      this.projected.copy(target.group.position);
      this.projected.y += bar.height;
      this.projected.project(camera);
      const visible =
        target.alive &&
        target.group.visible &&
        this.projected.z >= -1 &&
        this.projected.z <= 1 &&
        Math.abs(this.projected.x) < 1 &&
        Math.abs(this.projected.y) < 1;
      bar.element.hidden = !visible;
      if (!visible) continue;
      bar.element.style.transform = `translate(${(this.projected.x * 0.5 + 0.5) * width}px, ${(-this.projected.y * 0.5 + 0.5) * height}px) translate(-50%, -100%)`;
      bar.element.classList.toggle("selected", target === selected);
      if (bar.hp !== target.hp) {
        const hp = THREE.MathUtils.clamp(target.hp, 0, target.maxHp);
        bar.fill.style.transform = `scaleX(${target.maxHp > 0 ? hp / target.maxHp : 0})`;
        bar.element.setAttribute("aria-valuenow", String(Math.ceil(hp)));
        bar.hp = target.hp;
      }
    }
  }

  clear() {
    for (const bar of this.bars.values()) bar.element.remove();
    this.bars.clear();
  }
}
