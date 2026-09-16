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
const NIGHT = {
  mist: new THREE.Color(0x0b1c2b),
  sky: new THREE.Color(0x496786),
  ground: new THREE.Color(0x101b26),
  sun: new THREE.Color(0x789dcc),
};

export const DAY_CYCLE_SECONDS = 180;
export type DayStage = "day" | "dusk" | "night" | "dawn";

export interface DaylightState {
  stage: DayStage;
  darkness: number;
  isNight: boolean;
  label: string;
  secondsUntilNext: number;
}

/** Three-minute readable game cycle: long day, gradual dusk, night, short dawn. */
export function dayCycleAt(elapsed: number): DaylightState {
  const time =
    ((elapsed % DAY_CYCLE_SECONDS) + DAY_CYCLE_SECONDS) % DAY_CYCLE_SECONDS;
  if (time < 75)
    return {
      stage: "day",
      darkness: 0,
      isNight: false,
      label: "낮",
      secondsUntilNext: 75 - time,
    };
  if (time < 105) {
    const darkness = THREE.MathUtils.smoothstep(time, 75, 105);
    return {
      stage: "dusk",
      darkness,
      isNight: time >= 100,
      label: "해질녘",
      secondsUntilNext: 105 - time,
    };
  }
  if (time < 150)
    return {
      stage: "night",
      darkness: 1,
      isNight: true,
      label: "밤",
      secondsUntilNext: 150 - time,
    };
  const darkness = 1 - THREE.MathUtils.smoothstep(time, 150, 180);
  return {
    stage: "dawn",
    darkness,
    isNight: time < 155,
    label: "새벽",
    secondsUntilNext: 180 - time,
  };
}

/** Exploration depth and the time cycle combine to determine the forest's mood. */
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
  private night = 0;
  private mixed = {
    mist: new THREE.Color(),
    sky: new THREE.Color(),
    ground: new THREE.Color(),
    sun: new THREE.Color(),
  };

  constructor(scene: THREE.Scene, ring = 1) {
    this.depth = forestDepth(ring, 0);
    scene.background = this.background;
    scene.fog = this.fog;
    scene.add(this.sky, this.sun);
    this.apply();
  }

  update(dt: number, ring: number, distance: number, worldTime = 0) {
    const target = forestDepth(ring, distance);
    this.depth = THREE.MathUtils.lerp(
      this.depth,
      target,
      1 - Math.exp(-Math.max(0, dt) / 2.5),
    );
    this.night = dayCycleAt(worldTime).darkness;
    this.apply();
    return { depth: this.depth, daylight: dayCycleAt(worldTime) };
  }

  private apply() {
    const depth = this.depth;
    const night = this.night;
    this.mixed.mist
      .lerpColors(DAY.mist, DEEP.mist, depth)
      .lerp(NIGHT.mist, night);
    this.mixed.sky.lerpColors(DAY.sky, DEEP.sky, depth).lerp(NIGHT.sky, night);
    this.mixed.ground
      .lerpColors(DAY.ground, DEEP.ground, depth)
      .lerp(NIGHT.ground, night);
    this.mixed.sun.lerpColors(DAY.sun, DEEP.sun, depth).lerp(NIGHT.sun, night);
    this.background.copy(this.mixed.mist);
    this.fog.color.copy(this.background);
    this.fog.near = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(55, 32, depth),
      25,
      night,
    );
    this.fog.far = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(115, 92, depth),
      76,
      night,
    );
    this.sky.color.copy(this.mixed.sky);
    this.sky.groundColor.copy(this.mixed.ground);
    // Retain readable silhouettes and ground detail, even at maximum depth.
    this.sky.intensity = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(1.7, 1.15, depth),
      0.58,
      night,
    );
    this.sun.color.copy(this.mixed.sun);
    this.sun.intensity = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(2.6, 0.85, depth),
      0.32,
      night,
    );
  }
}
