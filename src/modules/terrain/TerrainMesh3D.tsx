import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  getDemMeta,
  getTerrainAdapter,
  registerBundledTerrariumDem,
} from "@/services/terrain/terrainEngine";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { destinationPoint } from "@/utils/geo";
import { DEFAULT_MAP_CENTER } from "@/modules/map/mapStyles";
import { elevToRgb } from "@/services/terrain/heightColor";
import { useGisStore } from "@/stores/gisStore";

const GRID = 33;
const HALF_M = 2500; // ~5 km span — works offline around Smolensk DEM

function heightColor(elevM: number, minE: number, maxE: number): THREE.Color {
  const [r, g, b] = elevToRgb(elevM, minE, maxE);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

/**
 * Offline 3D DEM mesh — no station required (defaults to Смоленск).
 * Orbit: drag rotate, wheel zoom. Uses bundled Terrarium tiles.
 */
export function TerrainMesh3D({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const [detail, setDetail] = useState("Загрузка офлайн DEM…");
  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const az = useStationPlannerStore((s) => s.simAzimuthDeg);
  const el = useStationPlannerStore((s) => s.simElevationDeg);
  const lookAt = useStationPlannerStore((s) => s.lookAt);
  const st = stations.find((s) => s.id === activeStationId);
  const verticalExaggeration = useGisStore((s) => s.verticalExaggeration);

  const centerLat = st?.latitude ?? DEFAULT_MAP_CENTER[1];
  const centerLng = st?.longitude ?? DEFAULT_MAP_CENTER[0];

  const apiRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    root: THREE.Group;
    mesh: THREE.Mesh | null;
    mast: THREE.Group;
    beam: THREE.Mesh;
    lookMarker: THREE.Mesh;
    frameId: number;
    yaw: number;
    pitch: number;
    dist: number;
  } | null>(null);

  const [sceneReady, setSceneReady] = useState(false);

  // Init scene + orbit once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const w = Math.max(host.clientWidth, 320);
    const h = Math.max(host.clientHeight, 200);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1018);
    const camera = new THREE.PerspectiveCamera(50, w / h, 1, 20_000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x99aabb, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(400, 800, 200);
    scene.add(dir);

    const root = new THREE.Group();
    scene.add(root);

    const mast = new THREE.Group();
    root.add(mast);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4, 40, 10),
      new THREE.MeshStandardMaterial({ color: 0xc0c8d0 }),
    );
    pole.position.y = 20;
    mast.add(pole);
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(10, 14, 20, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x3d8bfd,
        side: THREE.DoubleSide,
      }),
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.set(0, 42, -6);
    mast.add(dish);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 14, 400, 12),
      new THREE.MeshStandardMaterial({
        color: 0x3d8bfd,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.set(0, 42, -200);
    mast.add(beam);

    const lookMarker = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8a838 }),
    );
    lookMarker.visible = false;
    root.add(lookMarker);

    let yaw = 0.6;
    let pitch = 0.55;
    let dist = 2200;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const applyCam = () => {
      const cp = Math.cos(pitch);
      camera.position.set(
        Math.sin(yaw) * cp * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * cp * dist,
      );
      camera.lookAt(0, 40, 0);
    };
    applyCam();

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      host.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.005;
      pitch = Math.min(1.35, Math.max(0.12, pitch + dy * 0.005));
      applyCam();
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dist = Math.min(8000, Math.max(400, dist * (e.deltaY > 0 ? 1.08 : 0.92)));
      applyCam();
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    host.addEventListener("wheel", onWheel, { passive: false });

    let frameId = 0;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const nw = Math.max(host.clientWidth, 32);
      const nh = Math.max(host.clientHeight, 32);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(host);

    apiRef.current = {
      renderer,
      scene,
      camera,
      root,
      mesh: null,
      mast,
      beam,
      lookMarker,
      frameId,
      yaw,
      pitch,
      dist,
    };
    setSceneReady(true);

    return () => {
      setSceneReady(false);
      cancelAnimationFrame(frameId);
      ro.disconnect();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      host.removeEventListener("wheel", onWheel);
      if (apiRef.current?.mesh) {
        apiRef.current.root.remove(apiRef.current.mesh);
        apiRef.current.mesh.geometry.dispose();
        const m = apiRef.current.mesh.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
      renderer.dispose();
      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
      apiRef.current = null;
    };
  }, []);

  // Sample DEM — station optional; offline Terrarium auto-register
  useEffect(() => {
    if (!sceneReady) return;
    const api = apiRef.current;
    if (!api) return;
    let cancelled = false;

    void (async () => {
      setStatus("loading");
      setDetail("Подключение офлайн DEM…");
      await registerBundledTerrariumDem();
      if (cancelled) return;

      const meta = getDemMeta();
      const adapter = getTerrainAdapter();
      if (meta.sourceType === "none" || adapter.id === "none") {
        setStatus("missing");
        setDetail(
          "Офлайн DEM не найден (public/dem-tiles). Положите Terrarium PNG.",
        );
        return;
      }

      const jobs: Promise<number | null>[] = [];
      for (let iz = 0; iz < GRID; iz++) {
        for (let ix = 0; ix < GRID; ix++) {
          const u = ix / (GRID - 1);
          const v = iz / (GRID - 1);
          const eastM = (u - 0.5) * 2 * HALF_M;
          const northM = (v - 0.5) * 2 * HALF_M;
          const dist = Math.hypot(eastM, northM);
          const brg = (Math.atan2(eastM, northM) * 180) / Math.PI;
          const p = destinationPoint(centerLat, centerLng, brg, dist);
          jobs.push(
            adapter.sample(p.lat, p.lng).then((s) =>
              s.missing ? null : s.elevationM,
            ),
          );
        }
      }
      const samples = await Promise.all(jobs);
      if (cancelled) return;

      const known = samples.filter((x): x is number => x != null);
      if (known.length < 8) {
        setStatus("missing");
        setDetail(
          `DEM: мало точек (${known.length}/${GRID * GRID}). Проверьте офлайн-тайлы Смоленска.`,
        );
        return;
      }

      const minE = Math.min(...known);
      const maxE = Math.max(...known);
      // Fill gaps with nearest known / mean so mesh always builds
      const mean =
        known.reduce((a, b) => a + b, 0) / Math.max(1, known.length);
      const filled = samples.map((e) => (e == null ? mean : e));

      const geom = new THREE.PlaneGeometry(
        HALF_M * 2,
        HALF_M * 2,
        GRID - 1,
        GRID - 1,
      );
      geom.rotateX(-Math.PI / 2);
      const pos = geom.attributes.position;
      if (!pos) {
        setStatus("missing");
        setDetail("Ошибка геометрии mesh");
        return;
      }
      const zScale = verticalExaggeration;
      const colors: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        const e = filled[i]!;
        const y = (e - minE) * zScale;
        pos.setY(i, y);
        const c = heightColor(e, minE, maxE);
        colors.push(c.r, c.g, c.b);
      }
      pos.needsUpdate = true;
      geom.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      geom.computeVertexNormals();

      if (api.mesh) {
        api.root.remove(api.mesh);
        api.mesh.geometry.dispose();
        const m = api.mesh.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        metalness: 0.05,
        roughness: 0.88,
      });
      const mesh = new THREE.Mesh(geom, mat);
      api.root.add(mesh);
      api.mesh = mesh;

      const stationElev =
        st?.terrainElevationM != null
          ? st.terrainElevationM
          : filled[Math.floor((GRID * GRID) / 2)]!;
      const stationY = (stationElev - minE) * zScale;
      api.mast.position.set(0, stationY, 0);
      api.mast.visible = Boolean(st);
      const mastH = Math.max(20, Math.min(80, (st?.mastHeightM ?? 12) * 2));
      api.mast.scale.set(1, mastH / 40, 1);

      setStatus("ready");
      setDetail(
        `${meta.name} · ${centerLat.toFixed(3)}, ${centerLng.toFixed(3)} · Δh ${(maxE - minE).toFixed(0)} м · Z×${zScale.toFixed(1)} (визуал.)`,
      );
    })().catch((e) => {
      if (!cancelled) {
        setStatus("missing");
        setDetail(e instanceof Error ? e.message : String(e));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    sceneReady,
    centerLat,
    centerLng,
    st?.id,
    st?.terrainElevationM,
    st?.mastHeightM,
    verticalExaggeration,
  ]);

  // Sync beam / look-at
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.mast.rotation.y = THREE.MathUtils.degToRad(-az);
    api.beam.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(-el);
    if (lookAt && st) {
      const dLat = (lookAt.lat - st.latitude) * 111_320;
      const dLng =
        (lookAt.lng - st.longitude) *
        111_320 *
        Math.cos((st.latitude * Math.PI) / 180);
      api.lookMarker.position.set(dLng, api.mast.position.y, -dLat);
      api.lookMarker.visible = true;
    } else {
      api.lookMarker.visible = false;
    }
  }, [az, el, lookAt, st]);

  return (
    <div
      className={
        className ?? "relative flex h-full min-h-[160px] flex-col"
      }
      data-testid="terrain-mesh-3d"
    >
      <div className="flex items-center justify-between border-b border-ags-border-subtle px-2 py-1 text-[10px]">
        <span className="text-ags-dim">
          3D рельеф · drag — вращение · колесо — масштаб
          {!st ? " · центр: Смоленск" : ""}
        </span>
        <span
          className={
            status === "ready"
              ? "text-ags-success"
              : status === "loading"
                ? "text-ags-muted"
                : "text-ags-warning"
          }
        >
          {status === "ready" ? "DEM OK" : status === "loading" ? "…" : "Н/Д"}
        </span>
      </div>
      <div ref={hostRef} className="relative min-h-0 flex-1 touch-none">
        {status !== "ready" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ags-bg/70 p-3 text-center text-[11px] text-ags-muted">
            {detail}
          </div>
        )}
      </div>
      {status === "ready" && (
        <p className="truncate px-2 text-[9px] text-ags-dim">{detail}</p>
      )}
    </div>
  );
}
