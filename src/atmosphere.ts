import * as THREE from "three";

const DAY = {
  mist: new THREE.Color(0x8baf91),
  sky: new THREE.Color(0xfff2ce),
  ground: new THREE.Color(0x477054),
  sun: new THREE.Color(0xffe3ac),
};
const DEEP = {
  mist: new THREE.Color(0x233d4a),
  sky: new THREE.Color(0x9fbfd6),
  ground: new THREE.Color(0x243e45),
  sun: new THREE.Color(0xa5c9dc),
};

/** Exploration, not elapsed time, determines the forest's mood. */
export function forestDepth(ring: number, distance: number) {
  const outer = THREE.MathUtils.smoothstep(distance, 8, 42);
  return ring >= 2 ? 0.4 + outer * 0.6 : outer * 0.4;
}

export class ForestAtmosphere {
  readonly sky = new THREE.HemisphereLight(DAY.sky, DAY.ground, 1.7);
  readonly sun = new THREE.DirectionalLight(DAY.sun, 2.6);
  private background = DAY.mist.clone();
  private fog = new THREE.Fog(DAY.mist, 55, 115);
  private depth: number;

  constructor(scene: THREE.Scene, ring = 1) {
    this.depth = forestDepth(ring, 0);
    scene.background = this.background;
    scene.fog = this.fog;
    scene.add(this.sky, this.sun);
    this.apply();
  }

  update(dt: number, ring: number, distance: number) {
    const target = forestDepth(ring, distance);
    this.depth = THREE.MathUtils.lerp(
      this.depth,
      target,
      1 - Math.exp(-Math.max(0, dt) / 2.5),
    );
    this.apply();
    return this.depth;
  }

  private apply() {
    const depth = this.depth;
    this.background.lerpColors(DAY.mist, DEEP.mist, depth);
    this.fog.color.copy(this.background);
    this.fog.near = THREE.MathUtils.lerp(55, 32, depth);
    this.fog.far = THREE.MathUtils.lerp(115, 92, depth);
    this.sky.color.lerpColors(DAY.sky, DEEP.sky, depth);
    this.sky.groundColor.lerpColors(DAY.ground, DEEP.ground, depth);
    // Retain readable silhouettes and ground detail, even at maximum depth.
    this.sky.intensity = THREE.MathUtils.lerp(1.7, 1.15, depth);
    this.sun.color.lerpColors(DAY.sun, DEEP.sun, depth);
    this.sun.intensity = THREE.MathUtils.lerp(2.6, 0.85, depth);
  }
}
