import * as THREE from "three";
import type { ModelLibrary } from "./models.ts";
import { ForestAtmosphere } from "./atmosphere.ts";

export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const material = (color: number) =>
  new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });

export class Scenery {
  readonly root = new THREE.Group();
  readonly ground: THREE.Mesh;
  private random = seededRandom(9317);
  private fire = new THREE.Group();
  private flameLight = new THREE.PointLight(0xffac51, 9, 9, 2);
  private water: THREE.Mesh;
  private motes: THREE.Points;
  private ember: THREE.Points;
  private boundary: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private atmosphere: ForestAtmosphere;
  private lanterns: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene, ring = 1) {
    this.atmosphere = new ForestAtmosphere(scene, ring);
    scene.add(this.root);
    const sun = this.atmosphere.sun;
    this.sun = sun;
    sun.position.set(-18, 32, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
      near: 1,
      far: 100,
    });
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0003;
    sun.shadow.radius = 3;

    const groundGeometry = new THREE.PlaneGeometry(
      115,
      115,
      65,
      65,
    ).toNonIndexed();
    groundGeometry.rotateX(-Math.PI / 2);
    const positions = groundGeometry.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    const grass = new THREE.Color();
    for (let i = 0; i < positions.count; i += 3) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      const noise =
        Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.035 + this.random() * 0.025;
      const far = Math.min(Math.hypot(x, z) / 55, 1);
      grass.setHSL(
        0.25 + far * 0.03,
        0.35 + far * 0.06,
        0.29 - far * 0.07 + noise,
      );
      for (let n = 0; n < 3; n++) grass.toArray(colors, (i + n) * 3);
    }
    groundGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.ground = new THREE.Mesh(
      groundGeometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    this.ground.receiveShadow = true;
    this.ground.name = "ground";
    this.root.add(this.ground);

    this.patch(0, 0, 6.5, 0x8f9462, 1, 0.8);
    this.patch(-0.6, 0.3, 5.7, 0xa79b70, 1, 0.82);
    this.path(
      [
        [-1, 2],
        [3, 5],
        [7, 9],
        [13, 12],
        [23, 17],
      ],
      1.3,
    );
    this.path(
      [
        [-2, -1],
        [-7, -4],
        [-12, -9],
        [-18, -17],
      ],
      1.15,
    );
    this.path(
      [
        [2, -1],
        [8, -3],
        [15, -5],
        [24, -4],
      ],
      0.9,
    );
    this.camp();
    this.details();

    this.patch(-22, 8, 7, 0xb8b189, 1, 0.53);
    this.patch(-22, 8, 6.6, 0x729b8a, 1, 0.53);
    this.water = this.patch(-22, 8, 6.2, 0x5e9d99, 1, 0.53);
    const waterMat = this.water.material as THREE.MeshStandardMaterial;
    waterMat.roughness = 0.3;
    waterMat.metalness = 0.12;
    for (let i = 0; i < 6; i++) {
      const ripple = new THREE.Mesh(
        new THREE.RingGeometry(1.5, 1.53, 48),
        new THREE.MeshBasicMaterial({
          color: 0xc4dfcb,
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
        }),
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.scale.set(1 + i * 0.4, 0.65, 1);
      ripple.position.set(-22, 0.045 + i * 0.001, 8);
      this.root.add(ripple);
    }
    this.boundary = new THREE.Mesh(
      new THREE.RingGeometry(23.1, 23.18, 128),
      new THREE.MeshBasicMaterial({
        color: 0xe5d9a2,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    this.boundary.rotation.x = -Math.PI / 2;
    this.boundary.position.y = 0.035;
    this.root.add(this.boundary);
    this.motes = this.points(80, 0xf2e7ad, 0.07, 44, 6);
    this.ember = this.points(15, 0xffc979, 0.06, 1, 1.8);
    this.ember.position.set(1, 0.4, -1);
  }

  private mesh(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent = this.root,
  ) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private patch(
    x: number,
    z: number,
    radius: number,
    color: number,
    sx = 1,
    sz = 1,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      material(color),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(sx, sz, 1);
    mesh.position.set(x, 0.012 + this.random() * 0.012, z);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  private path(points: number[][], width: number) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x, 0.03, z)),
    );
    const vertices: number[] = [];
    for (let i = 0; i < 60; i++) {
      const p = curve.getPoint(i / 59),
        tangent = curve.getTangent(i / 59);
      const w = width * (0.9 + Math.sin(i * 0.7) * 0.08);
      vertices.push(
        p.x - tangent.z * w,
        p.y,
        p.z + tangent.x * w,
        p.x + tangent.z * w,
        p.y,
        p.z - tangent.x * w,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    const indices: number[] = [];
    for (let i = 0; i < 59; i++)
      indices.push(
        i * 2,
        i * 2 + 2,
        i * 2 + 1,
        i * 2 + 1,
        i * 2 + 2,
        i * 2 + 3,
      );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mat = material(0xb3a678);
    mat.side = THREE.DoubleSide;
    const road = new THREE.Mesh(geometry, mat);
    road.receiveShadow = true;
    this.root.add(road);
  }

  private camp() {
    const wood = material(0x795a38),
      darkWood = material(0x584933),
      paleWood = material(0xb69461);
    const canvas = material(0xcbb881),
      roof = material(0x4f7464),
      stone = material(0x94947b);
    // Canvas cabin, raised wooden porch, roof ridge and copper chimney.
    const cabin = new THREE.Group();
    cabin.position.set(-3.2, 0, -2.2);
    cabin.rotation.y = -0.1;
    this.root.add(cabin);
    this.mesh(
      new THREE.BoxGeometry(3.7, 0.25, 3.2),
      darkWood,
      0,
      0.12,
      0,
      cabin,
    );
    this.mesh(new THREE.BoxGeometry(3.2, 2.2, 2.6), canvas, 0, 1.3, 0, cabin);
    for (const x of [-1.65, 1.65])
      for (const z of [-1.35, 1.35])
        this.mesh(
          new THREE.BoxGeometry(0.17, 2.6, 0.17),
          wood,
          x,
          1.4,
          z,
          cabin,
        );
    for (const x of [-1, 1]) {
      const side = this.mesh(
        new THREE.BoxGeometry(2.25, 0.16, 3.25),
        roof,
        x * 0.85,
        2.95,
        0,
        cabin,
      );
      side.rotation.z = (x * Math.PI) / 5;
    }
    this.mesh(
      new THREE.BoxGeometry(0.16, 0.16, 3.4),
      paleWood,
      0,
      3.56,
      0,
      cabin,
    );
    this.mesh(
      new THREE.BoxGeometry(0.9, 1.65, 0.06),
      darkWood,
      0,
      1.08,
      1.34,
      cabin,
    );
    this.mesh(
      new THREE.BoxGeometry(0.7, 0.68, 0.08),
      material(0xefc06d),
      -1,
      1.7,
      1.37,
      cabin,
    );
    this.mesh(
      new THREE.BoxGeometry(0.04, 0.7, 0.12),
      wood,
      -1,
      1.7,
      1.4,
      cabin,
    );
    this.mesh(
      new THREE.BoxGeometry(0.73, 0.04, 0.12),
      wood,
      -1,
      1.7,
      1.4,
      cabin,
    );
    for (let i = 0; i < 3; i++)
      this.mesh(
        new THREE.BoxGeometry(1.2, 0.12, 0.4),
        paleWood,
        0,
        0.22 - i * 0.055,
        1.65 + i * 0.3,
        cabin,
      );
    this.mesh(
      new THREE.BoxGeometry(0.45, 1.5, 0.45),
      stone,
      1,
      3.05,
      -0.5,
      cabin,
    );
    this.mesh(
      new THREE.BoxGeometry(0.63, 0.16, 0.63),
      darkWood,
      1,
      3.83,
      -0.5,
      cabin,
    );
    // Workbench and log pile.
    this.mesh(new THREE.BoxGeometry(2.3, 0.2, 1.1), paleWood, 3, 0.95, -3);
    for (const x of [2.2, 3.8])
      for (const z of [-3.35, -2.65])
        this.mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), wood, x, 0.45, z);
    this.mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), stone, 3.5, 1.3, -3);
    for (let i = 0; i < 6; i++) {
      const log = this.mesh(
        new THREE.CylinderGeometry(0.22, 0.25, 1.8, 9),
        wood,
        -5 + (i % 3) * 0.47,
        0.27 + Math.floor(i / 3) * 0.4,
        1.4,
      );
      log.rotation.x = Math.PI / 2;
      const end = this.mesh(
        new THREE.CircleGeometry(0.2, 9),
        paleWood,
        log.position.x,
        log.position.y,
        2.31,
      );
      end.rotation.z = this.random();
    }
    for (let i = 0; i < 4; i++)
      this.mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        i % 2 ? wood : paleWood,
        4.2 + (i % 2) * 0.7,
        0.3 + Math.floor(i / 2) * 0.6,
        -1.1,
      );
    // Stone-lined firepit and crossed logs.
    for (let i = 0; i < 12; i++)
      this.mesh(
        new THREE.DodecahedronGeometry(0.23, 0),
        stone,
        1 + Math.cos((i / 12) * Math.PI * 2) * 0.72,
        0.15,
        -1 + Math.sin((i / 12) * Math.PI * 2) * 0.72,
      );
    for (let i = 0; i < 3; i++) {
      const log = this.mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 1.15, 7),
        darkWood,
        1,
        0.2,
        -1,
      );
      log.rotation.set(Math.PI / 2, 0, (i * Math.PI) / 3);
    }
    this.fire.position.set(1, 0.2, -1);
    this.root.add(this.fire);
    for (let i = 0; i < 4; i++) {
      const flame = this.mesh(
        new THREE.ConeGeometry(0.24 - i * 0.035, 0.85 + i * 0.07, 5),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd075 : 0xe98d44 }),
        Math.sin(i * 2) * 0.16,
        0.48,
        Math.cos(i * 2) * 0.16,
        this.fire,
      );
      flame.rotation.z = (i - 2) * 0.1;
    }
    this.flameLight.position.set(1, 1, -1);
    this.root.add(this.flameLight);
    for (const x of [-0.6, 2.8])
      this.mesh(new THREE.BoxGeometry(0.55, 0.35, 1.9), wood, x, 0.3, -1);
    // Lanterns and rope fence mark the camp entrance.
    for (const x of [-1.9, 3.7]) {
      const light = new THREE.PointLight(0xffbd70, 1.5, 7, 2);
      light.position.set(x, 2, 3.9);
      this.root.add(light);
      this.lanterns.push(light);
      this.mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 2.3, 8),
        wood,
        x,
        1.1,
        3.9,
      );
      this.mesh(
        new THREE.BoxGeometry(0.34, 0.42, 0.34),
        new THREE.MeshStandardMaterial({
          color: 0xf6cf87,
          emissive: 0xf6bc54,
          emissiveIntensity: 0.7,
        }),
        x,
        1.95,
        3.9,
      );
      this.mesh(new THREE.ConeGeometry(0.31, 0.22, 4), darkWood, x, 2.28, 3.9);
    }
    for (let i = 0; i < 6; i++) {
      const z = -5,
        x = -5 + i * 1.8;
      this.mesh(new THREE.CylinderGeometry(0.09, 0.11, 1, 6), wood, x, 0.5, z);
      if (i < 5)
        this.mesh(
          new THREE.BoxGeometry(1.8, 0.08, 0.09),
          paleWood,
          x + 0.9,
          0.7,
          z,
        );
    }
  }

  private details() {
    const dummy = new THREE.Object3D();
    const grass = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.13, 0.48, 3),
      material(0x7d9250),
      1100,
    );
    const flower = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.12, 0),
      material(0xe7d7a1),
      180,
    );
    const rock = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.55, 0),
      material(0x8d957d),
      95,
    );
    for (const [mesh, count] of [
      [grass, 1100],
      [flower, 180],
      [rock, 95],
    ] as const) {
      for (let i = 0; i < count; i++) {
        const angle = this.random() * Math.PI * 2,
          radius = 7 + this.random() * 39;
        const x = Math.cos(angle) * radius,
          z = Math.sin(angle) * radius;
        dummy.position.set(
          x,
          mesh === grass ? 0.22 : mesh === flower ? 0.4 : 0.22,
          z,
        );
        if (Math.hypot(x + 22, (z - 8) * 1.8) < 7) dummy.position.y = -2;
        const scale = 0.5 + this.random() * (mesh === rock ? 1.6 : 0.9);
        dummy.scale.setScalar(scale);
        dummy.rotation.set(0, this.random() * Math.PI, 0.15 * this.random());
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(
          i,
          new THREE.Color().setHSL(
            mesh === grass ? 0.23 : mesh === flower ? 0.12 : 0.18,
            mesh === rock ? 0.1 : 0.3,
            0.32 + this.random() * 0.18,
          ),
        );
      }
      mesh.receiveShadow = true;
      mesh.castShadow = mesh === rock;
      this.root.add(mesh);
    }
  }

  decorate(models: ModelLibrary) {
    for (let i = 0; i < 125; i++) {
      const angle = this.random() * Math.PI * 2,
        radius = 25 + this.random() * 26;
      const tree = models.instance(i % 4 === 0 ? "oak" : "pine");
      tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      if (Math.hypot(tree.position.x + 22, (tree.position.z - 8) * 1.8) < 8)
        continue;
      tree.scale.multiplyScalar(0.85 + this.random() * 0.65);
      tree.rotation.y = this.random() * Math.PI * 2;
      this.root.add(tree);
    }
  }

  private points(
    count: number,
    color: number,
    size: number,
    spread: number,
    height: number,
  ) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (this.random() - 0.5) * spread;
      positions[i * 3 + 1] = this.random() * height;
      positions[i * 3 + 2] = (this.random() - 0.5) * spread;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.root.add(points);
    return points;
  }

  update(time: number, ring: number, dt = 0, distance = 0) {
    const depth = this.atmosphere.update(dt, ring, distance);
    for (const lantern of this.lanterns) lantern.intensity = 1.5 + depth * 7;
    const motesMaterial = this.motes.material as THREE.PointsMaterial;
    motesMaterial.opacity = 0.6 + depth * 0.25;
    this.fire.scale.set(
      1 + Math.sin(time * 7) * 0.06,
      1 + Math.sin(time * 11) * 0.12,
      1,
    );
    this.flameLight.intensity = 8 + depth * 5 + Math.sin(time * 9) * 1.5;
    this.motes.rotation.y = time * 0.008;
    this.ember.rotation.y = time * 0.25;
    const p = this.ember.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) p.setY(i, (time * 0.65 + i * 0.17) % 1.8);
    p.needsUpdate = true;
    this.water.position.y = 0.028 + Math.sin(time * 0.6) * 0.002;
    this.boundary.visible = ring === 1;
  }

  dispose() {
    this.sun.shadow.dispose();
  }
}
