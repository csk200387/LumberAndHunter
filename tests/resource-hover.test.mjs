import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ResourceHover, pickHarvestable } from "../src/resource-hover.ts";
import { Effects } from "../src/effects.ts";
import { disposeObjects } from "../src/models.ts";

function fixture() {
  const canvas = new EventTarget(),
    controller = new AbortController();
  canvas.style = { cursor: "" };
  canvas.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: 100,
    height: 100,
  });
  canvas.ownerDocument = {
    defaultView: new EventTarget(),
    visibilityState: "visible",
    elementFromPoint: () => canvas,
  };
  const hover = new ResourceHover(canvas, controller.signal);
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  const group = new THREE.Group(),
    nested = new THREE.Group();
  nested.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    ),
  );
  group.add(nested);
  const item = { group, alive: true, kind: "tree", hp: 80 };
  const move = (pointerType = "mouse", buttons = 0) =>
    canvas.dispatchEvent(
      Object.assign(new Event("pointermove"), {
        clientX: 60,
        clientY: 70,
        pointerType,
        buttons,
      }),
    );
  const clean = () => {
    controller.abort();
    disposeObjects([group]);
  };
  return { canvas, controller, hover, camera, item, move, clean };
}

test("hover detects nested resource meshes before any click without damaging the target", () => {
  const f = fixture();
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.move();
  assert.equal(f.hover.update(f.camera, [f.item], true), f.item);
  assert.equal(f.item.hp, 80);
  assert.equal(f.canvas.style.cursor, "pointer");
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(), f.camera);
  assert.equal(pickHarvestable(ray, [f.item]), f.item);
  f.clean();
});

test("stationary pointer follows camera and resource motion, depletion and respawn", () => {
  const f = fixture();
  f.move();
  assert.equal(f.hover.update(f.camera, [f.item], true), f.item);
  f.item.group.position.x = 4;
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.camera.position.x = 4;
  f.camera.updateMatrixWorld();
  assert.equal(f.hover.update(f.camera, [f.item], true), f.item);
  f.item.alive = false;
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.item.alive = true;
  assert.equal(f.hover.update(f.camera, [f.item], true), f.item);
  f.item.group.visible = false;
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.clean();
});

test("UI overlays, disabled input and pointer exit clear hover feedback", () => {
  const f = fixture();
  f.move();
  assert.equal(f.hover.update(f.camera, [f.item], false), null);
  f.canvas.ownerDocument.elementFromPoint = () => ({});
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.canvas.ownerDocument.elementFromPoint = () => f.canvas;
  assert.equal(f.hover.update(f.camera, [f.item], true), f.item);
  f.canvas.dispatchEvent(new Event("pointerleave"));
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  assert.equal(f.canvas.style.cursor, "");
  f.clean();
});

test("touch, dragging, window blur and disposal do not leave stale hover targets", () => {
  const f = fixture();
  f.move("touch");
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.move("mouse", 1);
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.move();
  f.canvas.ownerDocument.defaultView.dispatchEvent(new Event("blur"));
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.move();
  f.controller.abort();
  f.move();
  assert.equal(f.hover.update(f.camera, [f.item], true), null);
  f.clean();
});

test("hover range is independent of the selected target and disappears on reset", () => {
  const scene = new THREE.Scene(),
    effects = new Effects(scene, { clientWidth: 800, clientHeight: 600 });
  const player = new THREE.Group(),
    camera = new THREE.Camera();
  const selected = { group: new THREE.Group(), alive: true, kind: "tree" };
  const hovered = { group: new THREE.Group(), alive: true, kind: "animal" };
  hovered.group.position.set(4, 0, 7);
  effects.update(0, 0, camera, player, null, false, hovered);
  assert.equal(effects.hoverRing.visible, true);
  assert.equal(effects.selection.visible, false);
  assert.deepEqual(effects.hoverRing.position.toArray(), [4, 0.075, 7]);
  assert.equal(effects.hoverRing.scale.x, 0.7);
  effects.update(0, 0, camera, player, selected, false, hovered);
  assert.equal(effects.hoverRing.visible, true);
  assert.equal(effects.selection.visible, true);
  effects.update(0, 0, camera, player, selected, false, selected);
  assert.equal(effects.hoverRing.visible, false);
  assert.equal(effects.selection.visible, true);
  effects.update(0, 0, camera, player, null, false, hovered);
  effects.reset();
  assert.equal(effects.hoverRing.visible, false);
  assert.equal(effects.hoverFill.visible, false);
  effects.dispose();
  disposeObjects([scene]);
});
