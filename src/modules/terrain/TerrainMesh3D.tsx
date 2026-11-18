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
import { applyBeamTilt, makeBeamGeometry } from "@/modules/terrain/beamRig";

/** DEM sample grid — denser = smoother hills. */
const GRID = 65;
/** Half-span of terrain mesh in meters (~5 km across). */
const HALF_M = 2500;
/** Visual mast multiplier so a 12–15 m tower stays readable on a 5 km DEM. */
const MAST_VISUAL_SCALE = 3.5;
/** Beam length in scene meters (visual cone, not RF range). */
const BEAM_LEN = 900;
/** Far radius of the beam cone. */
const BEAM_FAR_R = 48;

type SceneApi = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  terrain: THREE.Mesh | null;
  /** Ground elevation (min DEM) offset applied to station. */
  groundY: number;
  minElev: number;
  zScale: number;
  /** Yaw around mast (PAN). */
  yawGroup: THREE.Group;
  /** Pitch hinge at dish — only this rotates for TILT. */
  pitchPivot: THREE.Group;
  mastMesh: THREE.Mesh;
  hub: THREE.Mesh;
  dish: THREE.Mesh;
  beam: THREE.Mesh;
  beamGlow: THREE.Mesh;
  targetMarker: THREE.Mesh;
  losLine: THREE.Line;
  tipLocalY: number;
  frameId: number;
  disposeExtras: () => void;
};

function heightColor(elevM: number, minE: number, maxE: number): THREE.Color {
  const [r, g, b] = elevToRgb(elevM, minE, maxE);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

/** Vertical sky gradient as scene background. */
function makeSkyTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#6a93c4");
  grad.addColorStop(0.45, "#1a2838");
  grad.addColorStop(1, "#070b10");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDishGeometry(): THREE.BufferGeometry {
  // Parabolic-ish dish: open face at z=0 looking −Z, back toward +Z.
  const geo = new THREE.SphereGeometry(14, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 4);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Offline 3D DEM + antenna aiming preview.
 * Orbit: drag rotate, wheel zoom. Beam TILT hinges at dish tip only.
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
  const rangeKm = useStationPlannerStore((s) => s.rangeKm);
  const st = stations.find((s) => s.id === activeStationId);
  const verticalExaggeration = useGisStore((s) => s.verticalExaggeration);

  const centerLat = st?.latitude ?? DEFAULT_MAP_CENTER[1];
  const centerLng = st?.longitude ?? DEFAULT_MAP_CENTER[0];

  const apiRef = useRef<SceneApi | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const orbitRef = useRef({ yaw: 0.55, pitch: 0.48, dist: 1800 });

  // ── Scene bootstrap ──────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const w = Math.max(host.clientWidth, 320);
    const h = Math.max(host.clientHeight, 200);

    const scene = new THREE.Scene();
    const sky = makeSkyTexture();
    scene.background = sky;
    scene.fog = new THREE.FogExp2(0x1a2838, 0.00018);

    const camera = new THREE.PerspectiveCamera(48, w / h, 2, 30_000);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    // Lighting — soft outdoor look
    scene.add(new THREE.HemisphereLight(0xb8d0ef, 0x3a3020, 0.85));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.15);
    sun.position.set(600, 1200, 400);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6a8ab0, 0.35);
    fill.position.set(-400, 200, -600);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    // Subtle ground disc under DEM (helps depth when DEM sparse)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(HALF_M * 1.15, 64),
      new THREE.MeshStandardMaterial({
        color: 0x1c242e,
        roughness: 1,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    root.add(ground);

    const grid = new THREE.GridHelper(HALF_M * 2, 20, 0x3a5068, 0x243040);
    grid.position.y = 0.5;
    root.add(grid);

    // ── Antenna rig (meters → scene units, no non-uniform parent scale) ──
    const yawGroup = new THREE.Group();
    root.add(yawGroup);

    const mastH = 15 * MAST_VISUAL_SCALE;
    const mastMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3.2, mastH, 14),
      new THREE.MeshStandardMaterial({
        color: 0xc5ccd4,
        metalness: 0.55,
        roughness: 0.35,
      }),
    );
    mastMesh.position.y = mastH / 2;
    yawGroup.add(mastMesh);

    // Hub / mount at tip (does not pitch)
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 5, 5, 12),
      new THREE.MeshStandardMaterial({
        color: 0x6a7380,
        metalness: 0.4,
        roughness: 0.45,
      }),
    );
    hub.position.y = mastH;
    yawGroup.add(hub);

    // Pitch hinge EXACTLY at dish center / beam apex
    const pitchPivot = new THREE.Group();
    pitchPivot.position.y = mastH + 2;
    yawGroup.add(pitchPivot);

    const dish = new THREE.Mesh(
      makeDishGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0x3d8bfd,
        metalness: 0.35,
        roughness: 0.4,
        side: THREE.DoubleSide,
        emissive: 0x0a2040,
        emissiveIntensity: 0.25,
      }),
    );
    pitchPivot.add(dish);

    const feed = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xe8eef5,
        metalness: 0.6,
        roughness: 0.25,
      }),
    );
    pitchPivot.add(feed);

    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x5ad4ff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
      emissive: 0x1a6a9a,
      emissiveIntensity: 0.55,
      metalness: 0,
      roughness: 1,
    });
    const beam = new THREE.Mesh(makeBeamGeometry(BEAM_LEN, BEAM_FAR_R, 1.5), beamMat);
    pitchPivot.add(beam);

    const glowMat = beamMat.clone();
    glowMat.opacity = 0.12;
    glowMat.emissiveIntensity = 0.8;
    const beamGlow = new THREE.Mesh(
      makeBeamGeometry(BEAM_LEN * 1.02, BEAM_FAR_R * 1.35, 2),
      glowMat,
    );
    pitchPivot.add(beamGlow);

    // Target + LOS
    const targetMarker = new THREE.Mesh(
      new THREE.SphereGeometry(10, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xe8a838,
        emissive: 0x8a5010,
        emissiveIntensity: 0.5,
      }),
    );
    targetMarker.visible = false;
    root.add(targetMarker);

    const losGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, -1),
    ]);
    const losLine = new THREE.Line(
      losGeom,
      new THREE.LineDashedMaterial({
        color: 0xf0c14a,
        dashSize: 40,
        gapSize: 24,
        transparent: true,
        opacity: 0.85,
      }),
    );
    losLine.computeLineDistances();
    losLine.visible = false;
    root.add(losLine);

    // Orbit camera
    const orbit = orbitRef.current;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const applyCam = () => {
      const { yaw, pitch, dist } = orbit;
      const cp = Math.cos(pitch);
      camera.position.set(
        Math.sin(yaw) * cp * dist,
        Math.sin(pitch) * dist + 40,
        Math.cos(yaw) * cp * dist,
      );
      camera.lookAt(0, mastH * 0.45, 0);
    };
    applyCam();

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
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
      orbit.yaw -= dx * 0.005;
      orbit.pitch = Math.min(1.4, Math.max(0.08, orbit.pitch + dy * 0.005));
      applyCam();
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.dist = Math.min(
        10_000,
        Math.max(280, orbit.dist * (e.deltaY > 0 ? 1.09 : 0.91)),
      );
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

    const disposeExtras = () => {
      sky.dispose();
      beam.geometry.dispose();
      beamGlow.geometry.dispose();
      dish.geometry.dispose();
      mastMesh.geometry.dispose();
      hub.geometry.dispose();
      feed.geometry.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      (mastMesh.material as THREE.Material).dispose();
      (hub.material as THREE.Material).dispose();
      (feed.material as THREE.Material).dispose();
      (dish.material as THREE.Material).dispose();
      beamMat.dispose();
      glowMat.dispose();
      (targetMarker.material as THREE.Material).dispose();
      targetMarker.geometry.dispose();
      losGeom.dispose();
      (losLine.material as THREE.Material).dispose();
    };

    apiRef.current = {
      renderer,
      scene,
      camera,
      root,
      terrain: null,
      groundY: 0,
      minElev: 0,
      zScale: 1,
      yawGroup,
      pitchPivot,
      mastMesh,
      hub,
      dish,
      beam,
      beamGlow,
      targetMarker,
      losLine,
      tipLocalY: mastH + 2,
      frameId,
      disposeExtras,
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
      const api = apiRef.current;
      if (api?.terrain) {
        api.root.remove(api.terrain);
        api.terrain.geometry.dispose();
        const m = api.terrain.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
      disposeExtras();
      renderer.dispose();
      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
      apiRef.current = null;
    };
  }, []);

  // ── DEM terrain mesh ─────────────────────────────────────────────
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
      if (known.length < 16) {
        setStatus("missing");
        setDetail(
          `DEM: мало точек (${known.length}/${GRID * GRID}). Проверьте офлайн-тайлы.`,
        );
        return;
      }

      const minE = Math.min(...known);
      const maxE = Math.max(...known);
      const mean = known.reduce((a, b) => a + b, 0) / known.length;
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
        pos.setY(i, (e - minE) * zScale);
        const c = heightColor(e, minE, maxE);
        colors.push(c.r, c.g, c.b);
      }
      pos.needsUpdate = true;
      geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geom.computeVertexNormals();

      if (api.terrain) {
        api.root.remove(api.terrain);
        api.terrain.geometry.dispose();
        const m = api.terrain.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: false,
        metalness: 0.04,
        roughness: 0.92,
      });
      const mesh = new THREE.Mesh(geom, mat);
      // Soft wire overlay for relief readability
      const wire = new THREE.Mesh(
        geom.clone(),
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          wireframe: true,
          transparent: true,
          opacity: 0.08,
        }),
      );
      mesh.add(wire);
      api.root.add(mesh);
      api.terrain = mesh;
      api.minElev = minE;
      api.zScale = zScale;

      const stationElev =
        st?.terrainElevationM != null
          ? st.terrainElevationM
          : filled[Math.floor((GRID * GRID) / 2)]!;
      const groundY = (stationElev - minE) * zScale;
      api.groundY = groundY;
      api.yawGroup.position.set(0, groundY, 0);
      api.yawGroup.visible = Boolean(st);

      // Mast height from station — absolute meters, no parent Y-scale
      const realMast = st?.mastHeightM ?? 15;
      const visualMast = Math.max(28, Math.min(100, realMast * MAST_VISUAL_SCALE));
      api.mastMesh.geometry.dispose();
      api.mastMesh.geometry = new THREE.CylinderGeometry(2.2, 3.2, visualMast, 14);
      api.mastMesh.position.y = visualMast / 2;
      api.tipLocalY = visualMast + 2;
      api.pitchPivot.position.set(0, api.tipLocalY, 0);
      api.hub.position.y = visualMast;

      setStatus("ready");
      setDetail(
        `${meta.name} · ${centerLat.toFixed(3)}, ${centerLng.toFixed(3)} · Δh ${(maxE - minE).toFixed(0)} м · Z×${zScale.toFixed(1)}`,
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

  // ── PAN / TILT / target sync ─────────────────────────────────────
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    // PAN: yaw whole mast + dish + beam
    api.yawGroup.rotation.y = THREE.MathUtils.degToRad(-az);

    // TILT: only pitchPivot at dish. +EL raises wide far end of beam.
    api.pitchPivot.position.set(0, api.tipLocalY, 0);
    applyBeamTilt(api.pitchPivot, el);

    // Scale beam length with configured range (visual only)
    const lenScale = Math.min(1.6, Math.max(0.45, (rangeKm * 1000) / 8000));
    api.beam.scale.set(1, 1, lenScale);
    api.beamGlow.scale.set(1, 1, lenScale);

    if (lookAt && st) {
      const dLat = (lookAt.lat - st.latitude) * 111_320;
      const dLng =
        (lookAt.lng - st.longitude) *
        111_320 *
        Math.cos((st.latitude * Math.PI) / 180);
      // Target height: ground at station + small offset (DEM-relative)
      const ty = api.groundY + 12;
      api.targetMarker.position.set(dLng, ty, -dLat);
      api.targetMarker.visible = true;

      // LOS from dish world tip → target
      const tip = new THREE.Vector3(0, 0, 0);
      api.pitchPivot.getWorldPosition(tip);
      api.root.worldToLocal(tip);
      const tgt = api.targetMarker.position.clone();
      const positions = api.losLine.geometry.attributes.position;
      if (positions) {
        positions.setXYZ(0, tip.x, tip.y, tip.z);
        positions.setXYZ(1, tgt.x, tgt.y, tgt.z);
        positions.needsUpdate = true;
        api.losLine.computeLineDistances();
        api.losLine.visible = true;
      }
    } else {
      api.targetMarker.visible = false;
      api.losLine.visible = false;
    }
  }, [az, el, lookAt, st, rangeKm, st?.mastHeightM, st?.terrainElevationM]);

  return (
    <div
      className={
        className ?? "relative flex h-full min-h-[160px] flex-col"
      }
      data-testid="terrain-mesh-3d"
    >
      <div className="flex items-center justify-between gap-2 border-b border-ags-border-subtle bg-ags-panel/60 px-2 py-1 text-[10px] backdrop-blur-sm">
        <span className="text-ags-dim">
          3D · ЛКМ — орбита · колесо — масштаб
          {!st ? " · центр: Смоленск" : ` · ${st.name}`}
        </span>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="text-ags-muted">
            PAN {az.toFixed(1)}° · TILT {el.toFixed(1)}°
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
      </div>
      <div ref={hostRef} className="relative min-h-0 flex-1 touch-none">
        {status !== "ready" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ags-bg/70 p-3 text-center text-[11px] text-ags-muted">
            {detail}
          </div>
        )}
        {status === "ready" && (
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[16rem] rounded bg-black/45 px-2 py-1 text-[9px] leading-snug text-white/80">
            Луч: узкий конец зафиксирован в тарелке · TILT поднимает широкий
            конец
          </div>
        )}
      </div>
      {status === "ready" && (
        <p className="truncate px-2 text-[9px] text-ags-dim">{detail}</p>
      )}
    </div>
  );
}
