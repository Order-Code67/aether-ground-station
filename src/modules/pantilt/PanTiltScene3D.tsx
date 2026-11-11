import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface PanTiltScene3DProps {
  azimuthDeg: number;
  elevationDeg: number;
  mastHeightM?: number | null;
  className?: string;
}

/**
 * Parametric pan-tilt visualization (simulation only).
 * No remote actuator commands — visual geometry only.
 */
export function PanTiltScene3D({
  azimuthDeg,
  elevationDeg,
  mastHeightM,
  className,
}: PanTiltScene3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    platform: THREE.Group;
    boom: THREE.Group;
    beam: THREE.Mesh;
    frameId: number;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const w = host.clientWidth || 320;
    const h = host.clientHeight || 200;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d24);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.set(8, 6, 10);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    host.appendChild(renderer.domElement);

    const amb = new THREE.AmbientLight(0x8899aa, 0.7);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 12, 4);
    scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(6, 48),
      new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.9 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(12, 12, 0x3a4450, 0x2a323c);
    scene.add(grid);

    const mastH = Math.max(1.5, Math.min(12, mastHeightM ?? 4));
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.8, 0.35, 16),
      new THREE.MeshStandardMaterial({ color: 0x555c66 }),
    );
    base.position.y = 0.175;
    scene.add(base);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, mastH, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a929c }),
    );
    mast.position.y = mastH / 2 + 0.35;
    scene.add(mast);

    const platform = new THREE.Group();
    platform.position.y = mastH + 0.35;
    scene.add(platform);

    const hub = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.25, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x4a5562 }),
    );
    platform.add(hub);

    const boom = new THREE.Group();
    platform.add(boom);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x6a7380 }),
    );
    arm.position.z = -0.55;
    boom.add(arm);

    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.55, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x3d8bfd,
        side: THREE.DoubleSide,
        metalness: 0.3,
        roughness: 0.4,
      }),
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.z = -1.25;
    boom.add(dish);

    const beamGeom = new THREE.CylinderGeometry(0.04, 0.28, 5, 16);
    const beam = new THREE.Mesh(
      beamGeom,
      new THREE.MeshStandardMaterial({
        color: 0x3d8bfd,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.z = -3.6;
    boom.add(beam);

    let frameId = 0;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      if (!host) return;
      const nw = host.clientWidth || 320;
      const nh = host.clientHeight || 200;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    apiRef.current = {
      renderer,
      scene,
      camera,
      platform,
      boom,
      beam,
      frameId,
    };

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      apiRef.current = null;
    };
  }, [mastHeightM]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    // Azimuth: Yaw around mast (compass: 0 = north = -Z in our model).
    api.platform.rotation.y = THREE.MathUtils.degToRad(-azimuthDeg);
    // Elevation: boom along −Z; +rotation.x tips toward +Y (up). Slider up = raise.
    api.boom.rotation.x = THREE.MathUtils.degToRad(elevationDeg);
  }, [azimuthDeg, elevationDeg]);

  const setCamera = (preset: "front" | "side" | "top" | "persp") => {
    const api = apiRef.current;
    if (!api) return;
    const { camera } = api;
    if (preset === "front") camera.position.set(0, 4, 12);
    else if (preset === "side") camera.position.set(12, 4, 0);
    else if (preset === "top") camera.position.set(0.01, 16, 0);
    else camera.position.set(8, 6, 10);
    camera.lookAt(0, 2, 0);
  };

  return (
    <div className={className ?? "flex h-full min-h-[160px] flex-col"}>
      <div className="flex flex-wrap gap-1 border-b border-ags-border-subtle px-1 py-0.5 text-[10px]">
        <span className="text-ags-dim">3D · симуляция</span>
        <button
          type="button"
          className="rounded border border-ags-border px-1"
          onClick={() => setCamera("persp")}
        >
          Персп.
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-1"
          onClick={() => setCamera("front")}
        >
          Спереди
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-1"
          onClick={() => setCamera("side")}
        >
          Сбоку
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-1"
          onClick={() => setCamera("top")}
        >
          Сверху
        </button>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  );
}
