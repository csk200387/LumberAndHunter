import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ResourceBars } from "../src/resource-bars.ts";

function fixture() {
  const document = {
    createElement() {
      return {
        style: {},
        attributes: {},
        children: [],
        hidden: false,
        classList: { toggle() {} },
        setAttribute(key, value) {
          this.attributes[key] = value;
        },
        appendChild(child) {
          this.children.push(child);
          child.parent = this;
        },
        remove() {
          this.parent.children.splice(this.parent.children.indexOf(this), 1);
        },
      };
    },
  };
  const root = Object.assign(document.createElement(), {
    ownerDocument: document,
    clientWidth: 800,
    clientHeight: 600,
  });
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 8, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const target = {
    species: "pine",
    kind: "tree",
    group: new THREE.Group(),
    hp: 80,
    maxHp: 80,
    alive: true,
  };
  const bars = new ResourceBars(root);
  bars.add(target);
  return { root, camera, target, bars };
}

test("resources show a full bar before selection and update as damage is dealt", () => {
  const { root, camera, target, bars } = fixture();
  bars.update(camera, null);
  const bar = root.children[0];
  assert.equal(bar.hidden, false);
  assert.equal(bar.children[0].style.transform, "scaleX(1)");
  assert.equal(bar.attributes["aria-label"], "소나무 체력");
  target.hp = 40;
  bars.update(camera, target);
  assert.equal(bar.children[0].style.transform, "scaleX(0.5)");
  assert.equal(bar.attributes["aria-valuenow"], "40");
});

test("depleted and offscreen resources hide their bars; respawns show a full bar again", () => {
  const { root, camera, target, bars } = fixture();
  const bar = root.children[0];
  target.hp = 0;
  target.alive = false;
  bars.update(camera, null);
  assert.equal(bar.hidden, true);
  target.hp = 80;
  target.alive = true;
  bars.update(camera, null);
  assert.equal(bar.hidden, false);
  assert.equal(bar.children[0].style.transform, "scaleX(1)");
  target.group.position.x = 100;
  bars.update(camera, null);
  assert.equal(bar.hidden, true);
});

test("bars are not duplicated and are removed on world reset", () => {
  const { root, target, bars } = fixture();
  bars.add(target);
  assert.equal(root.children.length, 1);
  bars.clear();
  assert.equal(root.children.length, 0);
});
