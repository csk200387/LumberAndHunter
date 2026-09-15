import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const ACCELERATION = 22;
const BRAKING = 28;
const TURN_SPEED = 10;

/** Fixed-tick movement with a separate, interpolated pose for rendering. */
export class PlayerMotion {
  speed = 0;
  private previousPosition = new THREE.Vector3();
  private previousRotation = new THREE.Quaternion();
  private currentPosition = new THREE.Vector3();
  private currentRotation = new THREE.Quaternion();
  private direction = new THREE.Vector3();
  private facing = new THREE.Quaternion();

  reset(player: THREE.Object3D) {
    this.speed = 0;
    this.capture(player);
    this.currentPosition.copy(player.position);
    this.currentRotation.copy(player.quaternion);
  }

  capture(player: THREE.Object3D) {
    this.previousPosition.copy(player.position);
    this.previousRotation.copy(player.quaternion);
  }

  face(player: THREE.Object3D, target: THREE.Vector3, dt: number) {
    this.direction.subVectors(target, player.position).setY(0);
    if (this.direction.lengthSq() < 0.000001) return;
    this.facing.setFromAxisAngle(
      UP,
      Math.atan2(this.direction.x, this.direction.z),
    );
    player.quaternion.rotateTowards(this.facing, TURN_SPEED * dt);
  }

  move(
    player: THREE.Object3D,
    target: THREE.Vector3,
    dt: number,
    maxSpeed: number,
    stopDistance = 0,
  ): boolean {
    this.direction.subVectors(target, player.position).setY(0);
    const distance = this.direction.length();
    const remaining = Math.max(0, distance - stopDistance);
    if (dt <= 0) return remaining <= 0.015;
    if (remaining <= 0.015) {
      if (distance > 0 && remaining > 0)
        player.position.addScaledVector(this.direction, remaining / distance);
      this.speed = 0;
      return true;
    }
    this.face(player, target, dt);
    const alignment = Math.max(
      0.15,
      Math.cos(player.quaternion.angleTo(this.facing)),
    );
    const desiredSpeed =
      Math.min(maxSpeed, Math.sqrt(2 * BRAKING * remaining)) * alignment;
    const rate = desiredSpeed > this.speed ? ACCELERATION : BRAKING;
    this.speed += THREE.MathUtils.clamp(
      desiredSpeed - this.speed,
      -rate * dt,
      rate * dt,
    );
    const step = Math.min(remaining, this.speed * dt);
    player.position.addScaledVector(this.direction, step / distance);
    if (remaining - step <= 0.015) {
      player.position.addScaledVector(
        this.direction,
        (remaining - step) / distance,
      );
      this.speed = 0;
      return true;
    }
    return false;
  }

  stop() {
    this.speed = 0;
  }

  interpolate(player: THREE.Object3D, alpha: number) {
    this.currentPosition.copy(player.position);
    this.currentRotation.copy(player.quaternion);
    player.position.lerpVectors(
      this.previousPosition,
      this.currentPosition,
      alpha,
    );
    player.quaternion.slerpQuaternions(
      this.previousRotation,
      this.currentRotation,
      alpha,
    );
  }

  restore(player: THREE.Object3D) {
    player.position.copy(this.currentPosition);
    player.quaternion.copy(this.currentRotation);
  }
}
