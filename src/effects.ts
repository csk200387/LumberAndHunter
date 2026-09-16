import * as THREE from "three";
import type { Harvestable } from "./types.ts";

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}
interface Label {
  element: HTMLElement;
  position: THREE.Vector3;
  life: number;
  duration: number;
}
interface FallingEntity {
  group: THREE.Group;
  scale: THREE.Vector3;
  rotation: THREE.Euler;
  life: number;
  tree: boolean;
}

export class Effects {
  private root = new THREE.Group();
  private particles: Particle[] = [];
  private labels: Label[] = [];
  private chipGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.16);
  private woodMaterial = new THREE.MeshStandardMaterial({
    color: 0xd5b07a,
    roughness: 1,
  });
  private leafMaterial = new THREE.MeshStandardMaterial({
    color: 0xb0c784,
    roughness: 1,
  });
  private hitMaterial = new THREE.MeshBasicMaterial({ color: 0xffe4aa });
  private destination: THREE.Mesh;
  private selection: THREE.Mesh;
  private hoverRing: THREE.Mesh;
  private hoverFill: THREE.Mesh;
  private playerRing: THREE.Mesh;
  private hitTimes = new Map<THREE.Group, number>();
  private falling: FallingEntity[] = [];
  private labelRoot: HTMLElement;

  constructor(scene: THREE.Scene, labelRoot: HTMLElement) {
    this.labelRoot = labelRoot;
    scene.add(this.root);
    const ring = (
      inner: number,
      outer: number,
      color: number,
      opacity: number,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 64),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.06;
      this.root.add(mesh);
      return mesh;
    };
    this.destination = ring(0.35, 0.4, 0xf6dc9e, 0.8);
    this.destination.visible = false;
    this.selection = ring(1, 1.04, 0xf4d693, 0.8);
    this.selection.visible = false;
    this.hoverRing = ring(1, 1.055, 0xc8eee0, 0.85);
    this.hoverFill = ring(0, 1, 0xc8eee0, 0.08);
    this.hoverRing.visible = this.hoverFill.visible = false;
    this.playerRing = ring(0.48, 0.55, 0xe8d299, 0.65);
  }

  move(position: THREE.Vector3) {
    this.destination.position.set(position.x, 0.07, position.z);
    this.destination.visible = true;
  }

  hit(target: Harvestable, damage: number) {
    this.hitTimes.set(target.group, 0.22);
    this.label(
      `−${Math.ceil(damage)}`,
      target.group.position
        .clone()
        .add(new THREE.Vector3(0, target.kind === "tree" ? 2.7 : 1.3, 0)),
      "damage",
      0.8,
    );
    this.burst(target.group.position, target.kind === "tree" ? 0 : 2, 8);
  }

  fall(target: Harvestable) {
    this.hitTimes.delete(target.group);
    target.group.rotation.z = 0;
    target.group.visible = true;
    this.falling.push({
      group: target.group,
      scale: target.group.scale.clone(),
      rotation: target.group.rotation.clone(),
      life: 0.65,
      tree: target.kind === "tree",
    });
  }

  burst(position: THREE.Vector3, kind = 0, count = 18) {
    for (let i = 0; i < count && this.particles.length < 160; i++) {
      const mesh = new THREE.Mesh(
        this.chipGeometry,
        kind === 0
          ? i % 2
            ? this.woodMaterial
            : this.leafMaterial
          : this.hitMaterial,
      );
      mesh.position.copy(position);
      mesh.position.y += 0.8;
      mesh.scale.setScalar(0.5 + Math.random() * 1.4);
      this.root.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          1.8 + Math.random() * 2,
          (Math.random() - 0.5) * 4,
        ),
        life: 0.65 + Math.random() * 0.3,
      });
    }
  }

  label(text: string, position: THREE.Vector3, style = "", duration = 1.2) {
    if (this.labels.length > 35) return;
    const element = document.createElement("div");
    element.className = `float-label ${style}`;
    element.textContent = text;
    this.labelRoot.appendChild(element);
    this.labels.push({
      element,
      position: position.clone(),
      life: duration,
      duration,
    });
  }

  update(
    dt: number,
    time: number,
    camera: THREE.Camera,
    player: THREE.Group,
    target: Harvestable | null,
    moving: boolean,
    hovered: Harvestable | null = null,
  ) {
    this.playerRing.position.set(player.position.x, 0.07, player.position.z);
    this.destination.visible = moving && !target;
    this.destination.scale.setScalar(1 + Math.sin(time * 5) * 0.12);
    this.selection.visible = !!target?.alive;
    if (target?.alive) {
      this.selection.position.set(
        target.group.position.x,
        0.07,
        target.group.position.z,
      );
      this.selection.scale.setScalar(target.kind === "tree" ? 1.2 : 0.7);
    }
    const showHover =
      !!hovered?.alive && hovered.group.visible && hovered !== target;
    this.hoverRing.visible = this.hoverFill.visible = showHover;
    if (showHover && hovered) {
      for (const marker of [this.hoverRing, this.hoverFill]) {
        marker.position.set(
          hovered.group.position.x,
          0.075,
          hovered.group.position.z,
        );
        marker.scale.setScalar(hovered.kind === "tree" ? 1.2 : 0.7);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= dt;
      particle.velocity.y -= 7 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 5;
      particle.mesh.rotation.z += dt * 3;
      particle.mesh.scale.multiplyScalar(Math.pow(0.3, dt));
      if (particle.life <= 0) {
        this.root.remove(particle.mesh);
        this.particles.splice(i, 1);
      }
    }
    for (const [group, remaining] of this.hitTimes) {
      const life = remaining - dt;
      group.rotation.z = Math.sin(life * 40) * Math.max(life, 0) * 0.12;
      if (life <= 0) {
        group.rotation.z = 0;
        this.hitTimes.delete(group);
      } else this.hitTimes.set(group, life);
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const falling = this.falling[i];
      falling.life -= dt;
      const progress = Math.min(1, 1 - falling.life / 0.65);
      if (falling.tree)
        falling.group.rotation.z =
          falling.rotation.z + progress * progress * 1.15;
      const shrink = 1 - Math.pow(Math.max(0, (progress - 0.45) / 0.55), 2);
      falling.group.scale.copy(falling.scale).multiplyScalar(shrink);
      if (falling.life <= 0) {
        falling.group.visible = false;
        falling.group.scale.copy(falling.scale);
        falling.group.rotation.copy(falling.rotation);
        this.falling.splice(i, 1);
      }
    }
    const width = this.labelRoot.clientWidth,
      height = this.labelRoot.clientHeight;
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const label = this.labels[i];
      label.life -= dt;
      const projected = label.position.clone().project(camera);
      const rise = (1 - label.life / label.duration) * 44;
      label.element.style.transform = `translate(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height - rise}px) translate(-50%, -50%)`;
      label.element.style.opacity = String(Math.min(1, label.life * 3));
      if (label.life <= 0) {
        label.element.remove();
        this.labels.splice(i, 1);
      }
    }
  }

  reset() {
    this.hoverRing.visible = this.hoverFill.visible = false;
    for (const particle of this.particles) this.root.remove(particle.mesh);
    for (const label of this.labels) label.element.remove();
    for (const group of this.hitTimes.keys()) group.rotation.z = 0;
    for (const falling of this.falling) {
      falling.group.visible = false;
      falling.group.scale.copy(falling.scale);
      falling.group.rotation.copy(falling.rotation);
    }
    this.falling = [];
    this.particles = [];
    this.labels = [];
    this.hitTimes.clear();
  }

  dispose() {
    this.reset();
    this.chipGeometry.dispose();
    this.woodMaterial.dispose();
    this.leafMaterial.dispose();
    this.hitMaterial.dispose();
  }
}
