import * as THREE from "three";
import type { Harvestable } from "./types.ts";

/** Use the same model hit test for previews and clicks. */
export function pickHarvestable(
  raycaster: THREE.Raycaster,
  harvestables: Harvestable[],
): Harvestable | null {
  const live = harvestables.filter((item) => item.alive && item.group.visible);
  for (const item of live) item.group.updateWorldMatrix(true, true);
  const hit = raycaster.intersectObjects(
    live.map((item) => item.group),
    true,
  )[0];
  if (!hit) return null;
  let node: THREE.Object3D | null = hit.object;
  while (node) {
    const item = live.find((item) => item.group === node);
    if (item) return item;
    node = node.parent;
  }
  return null;
}

export class ResourceHover {
  private pointer: THREE.Vector2 | null = null;
  private ndc = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, signal: AbortSignal) {
    this.canvas = canvas;
    const options = { signal };
    canvas.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch" || event.buttons !== 0) {
          this.clear();
          return;
        }
        this.pointer ??= new THREE.Vector2();
        this.pointer.set(event.clientX, event.clientY);
      },
      options,
    );
    for (const type of ["pointerleave", "pointercancel"])
      canvas.addEventListener(type, () => this.clear(), options);
    canvas.ownerDocument.defaultView?.addEventListener(
      "blur",
      () => this.clear(),
      options,
    );
    signal.addEventListener("abort", () => this.clear(), { once: true });
  }

  private clear() {
    this.pointer = null;
    this.canvas.style.cursor = "";
  }

  update(camera: THREE.Camera, harvestables: Harvestable[], enabled: boolean) {
    const pointer = this.pointer,
      document = this.canvas.ownerDocument;
    let target: Harvestable | null = null;
    if (
      enabled &&
      pointer &&
      document.visibilityState !== "hidden" &&
      document.elementFromPoint(pointer.x, pointer.y) === this.canvas
    ) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.ndc.set(
          ((pointer.x - rect.left) / rect.width) * 2 - 1,
          -((pointer.y - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(this.ndc, camera);
        target = pickHarvestable(this.raycaster, harvestables);
      }
    }
    const cursor = target ? "pointer" : "";
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
    return target;
  }
}
