import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URLS: Record<string, string> = {
  pine: "models/tree_pine.glb",
  oak: "models/tree_oak.glb",
  rabbit: "models/rabbit.glb",
  chicken: "models/chicken.glb",
  deer: "models/deer.glb",
  boar: "models/boar.glb",
  player: "models/character_a.glb",
  worker: "models/character_b.glb",
  carrier: "models/character_c.glb",
};
// per-model fit — tuned by eye against the old primitive sizes, not from any spec
const MODEL_SCALE: Record<string, number> = {
  pine: 4.1,
  oak: 4.5,
  rabbit: 0.48,
  chicken: 0.48,
  deer: 0.72,
  boar: 0.72,
  player: 0.78,
  worker: 0.73,
  carrier: 0.73,
};

export class ModelLibrary {
  private models = new Map<string, THREE.Group>();
  private clips = new Map<string, THREE.AnimationClip[]>();
  private actors = new Map<
    THREE.Group,
    {
      mixer: THREE.AnimationMixer;
      actions: Map<string, THREE.AnimationAction>;
      current: string;
      previous: THREE.Vector3;
      attackUntil: number;
      movingUntil: number;
      motionSpeed?: number;
      walkingSpeed: number;
    }
  >();

  async load() {
    const loader = new GLTFLoader();
    const entries = Object.entries(MODEL_URLS);
    const results = await Promise.allSettled(
      entries.map(async ([key, url]) => {
        const gltf = await loader.loadAsync(url);
        this.models.set(key, gltf.scene);
        this.clips.set(key, gltf.animations);
        const converted = new Map<THREE.Material, THREE.Material>();
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
          const prepare = (source: THREE.Material) => {
            if (converted.has(source)) return converted.get(source)!;
            let mat = source;
            if (source instanceof THREE.MeshBasicMaterial) {
              mat = new THREE.MeshStandardMaterial({
                map: source.map,
                color: source.color,
                side: source.side,
                roughness: 1,
              });
              source.dispose();
            }
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.metalness = 0;
              mat.roughness = 1;
            }
            converted.set(source, mat);
            return mat;
          };
          object.material = Array.isArray(object.material)
            ? object.material.map(prepare)
            : prepare(object.material);
        });
        if (key === "pine" || key === "oak")
          this.fixTreeFoliageColor(gltf.scene);
      }),
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      this.dispose();
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        "Model loading failed",
      );
    }
  }

  private fixTreeFoliageColor(root: THREE.Object3D) {
    // this glTF re-export ships tree foliage as a placeholder teal/cyan instead of green
    // (trunk/highlight materials are fine) — recolor on the shared template before any cloning.
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      for (const mat of materials) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
        const c = mat.color;
        if (c.g > c.r + 0.15 && c.b > c.r + 0.15) mat.color.setHex(0x527c43);
        else if (mat.name.toLowerCase().includes("wood"))
          mat.color.setHex(0x846244);
      }
    });
  }

  instance(key: string): THREE.Group {
    const template = this.models.get(key);
    if (!template) throw new Error(`model not loaded: ${key}`);
    const instance = template.clone(true);
    instance.scale.setScalar(MODEL_SCALE[key] ?? 1);
    const clips = this.clips.get(key) ?? [];
    if (clips.length) {
      const mixer = new THREE.AnimationMixer(instance);
      const actions = new Map(
        clips.map((clip) => [clip.name, mixer.clipAction(clip)]),
      );
      actions.get("idle")?.play();
      this.actors.set(instance, {
        mixer,
        actions,
        current: "idle",
        previous: instance.position.clone(),
        attackUntil: 0,
        movingUntil: 0,
        walkingSpeed: (4 * (MODEL_SCALE[key] ?? 0.78)) / 0.78,
      });
    }
    if (key === "player" || key === "worker") {
      const arm = instance.getObjectByName("arm-right");
      if (arm) {
        const axe = new THREE.Group();
        axe.name = "equipped-axe";
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.055, 0.95, 6),
          new THREE.MeshStandardMaterial({ color: 0x73523a, roughness: 1 }),
        );
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.32, 0.1),
          new THREE.MeshStandardMaterial({
            color: 0xc6d0c0,
            metalness: 0.5,
            roughness: 0.45,
          }),
        );
        head.position.set(0.1, 0.38, 0);
        axe.add(handle, head);
        axe.position.set(-0.1, -0.75, 0.35);
        axe.rotation.x = Math.PI / 2;
        arm.add(axe);
      }
    }
    return instance;
  }

  strike(group: THREE.Group, now = performance.now() / 1000) {
    const actor = this.actors.get(group);
    if (actor) actor.attackUntil = now + 0.45;
  }

  setMotion(group: THREE.Group, speed: number) {
    const actor = this.actors.get(group);
    if (actor) {
      actor.motionSpeed = speed;
      if (speed > 0.08) actor.attackUntil = 0;
    }
  }

  update(dt: number, now: number) {
    for (const [group, actor] of this.actors) {
      if (!group.visible) continue;
      if (group.position.distanceToSquared(actor.previous) > 0.000002)
        actor.movingUntil = now + 0.12;
      const moving =
        actor.motionSpeed === undefined
          ? now < actor.movingUntil
          : actor.motionSpeed > 0.08;
      if (actor.motionSpeed !== undefined) {
        actor.actions
          .get("walk")
          ?.setEffectiveTimeScale(
            THREE.MathUtils.clamp(
              actor.motionSpeed / actor.walkingSpeed,
              0.4,
              1.8,
            ),
          );
      }
      const next =
        now < actor.attackUntil && actor.actions.has("attack-melee-right")
          ? "attack-melee-right"
          : moving
            ? "walk"
            : "idle";
      if (next !== actor.current) {
        actor.actions.get(actor.current)?.fadeOut(0.12);
        actor.actions.get(next)?.reset().fadeIn(0.12).play();
        actor.current = next;
      }
      actor.previous.copy(group.position);
      actor.mixer.update(dt);
    }
  }

  release(group: THREE.Group) {
    const actor = this.actors.get(group);
    actor?.mixer.stopAllAction();
    actor?.mixer.uncacheRoot(group);
    this.actors.delete(group);
    const axe = group.getObjectByName("equipped-axe");
    if (axe) {
      axe.removeFromParent();
      disposeObjects([axe]);
    }
  }

  templates(): THREE.Group[] {
    return [...this.models.values()];
  }

  clear() {
    for (const group of this.actors.keys()) this.release(group);
    this.clips.clear();
    this.models.clear();
  }

  dispose() {
    disposeObjects(this.templates());
    this.clear();
  }
}

/** Cloned models share GPU resources. Release each geometry, material and texture once. */
export function disposeObjects(roots: THREE.Object3D[]) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  for (const root of roots) {
    root.traverse((object) => {
      if (
        !(
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Line
        )
      )
        return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
