import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyBeamTilt,
  makeBeamGeometry,
  wideEndLocal,
} from "./beamRig";

describe("beamRig kinematics", () => {
  it("bakes narrow apex at origin and wide base on −Z", () => {
    const len = 100;
    const geo = makeBeamGeometry(len, 20, 1);
    const pos = geo.attributes.position!;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minRAtOrigin = Infinity;
    let maxRFar = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      const r = Math.hypot(x, y);
      if (Math.abs(z) < 2) minRAtOrigin = Math.min(minRAtOrigin, r);
      if (z < -len * 0.9) maxRFar = Math.max(maxRFar, r);
    }
    expect(maxZ).toBeLessThan(3);
    expect(minZ).toBeLessThan(-len * 0.95);
    expect(minRAtOrigin).toBeLessThan(3);
    expect(maxRFar).toBeGreaterThan(15);
  });

  it("keeps hinge fixed and raises wide end with +TILT", () => {
    const hinge = new THREE.Vector3(0, 0, 0);
    const at0 = wideEndLocal(200, 0);
    const at30 = wideEndLocal(200, 30);
    const at60 = wideEndLocal(200, 60);

    expect(Math.abs(at0.y)).toBeLessThan(1e-6);
    expect(at30.y).toBeGreaterThan(50);
    expect(at60.y).toBeGreaterThan(at30.y);

    const pivot = new THREE.Object3D();
    applyBeamTilt(pivot, 45);
    pivot.updateMatrixWorld(true);
    const h = hinge.clone().applyMatrix4(pivot.matrixWorld);
    expect(h.length()).toBeLessThan(1e-6);
  });

  it("does not drop the wide end below horizon for positive TILT", () => {
    for (const deg of [5, 15, 35, 70]) {
      expect(wideEndLocal(500, deg).y).toBeGreaterThan(0);
    }
  });
});
