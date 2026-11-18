import * as THREE from "three";

/**
 * Beam cone: NARROW apex at local origin, WIDE base at −Z.
 * Parent pitchPivot.rotation.x = +elevRad raises the wide end.
 */
export function makeBeamGeometry(
  length: number,
  farR: number,
  nearR = 1.2,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(nearR, farR, length, 28, 1, true);
  geo.translate(0, -length / 2, 0);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Apply mast-tip TILT: +elevationDeg lifts the far (−Z) end. */
export function applyBeamTilt(
  pitchPivot: THREE.Object3D,
  elevationDeg: number,
): void {
  const elev = Number.isFinite(elevationDeg) ? elevationDeg : 0;
  pitchPivot.rotation.set(
    THREE.MathUtils.degToRad(Math.max(-10, Math.min(85, elev))),
    0,
    0,
  );
}

/** World-ish local point of the wide beam tip after tilt (for tests / HUD). */
export function wideEndLocal(
  beamLen: number,
  elevationDeg: number,
): THREE.Vector3 {
  const pivot = new THREE.Object3D();
  applyBeamTilt(pivot, elevationDeg);
  pivot.updateMatrixWorld(true);
  const p = new THREE.Vector3(0, 0, -beamLen);
  return p.applyMatrix4(pivot.matrixWorld);
}
