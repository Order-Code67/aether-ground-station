import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getDemMeta, getTerrainAdapter } from "@/services/terrain/terrainEngine";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { destinationPoint } from "@/utils/geo";

const GRID = 17; // 17×17 samples
const HALF_M = 800; // ~1.6 km span

/**
 * DEM mesh around active station.
 * No DEM / all samples missing → explicit N/A (never invent heights).
 */
export function TerrainMesh3D({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [detail, setDetail] = useState("Загрузка DEM…");
  const stations = useStationPlannerStore((s) => s.stations);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const az = useStationPlannerStore((s) => s.simAzimuthDeg);
  const el = useStationPlannerStore((s) => s.simElevationDeg);
  const lookAt = useStationPlannerStore((s) => s.lookAt);
  const st = stations.find((s) => s.id === activeStationId);

  const apiRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    mesh: THREE.Mesh | null;
    mast: THREE.Group;
    beam: THREE.Mesh;
    lookMarker: THREE.Mesh;
    frameId: number;
  } | null>(null);

  // Init scene once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 200;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12171e);
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 5000);
    camera.position.set(0, 420, 620);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x99aabb, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(200, 400, 120);
    scene.add(dir);

    const mast = new THREE.Group();
    scene.add(mast);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 3, 40, 10),
      new THREE.MeshStandardMaterial({ color: 0xc0c8d0 }),
    );
    pole.position.y = 20;
    mast.add(pole);
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(8, 12, 20, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x3d8bfd,
        side: THREE.DoubleSide,
      }),
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.set(0, 42, -6);
    mast.add(dish);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 8, 200, 12),
      new THREE.MeshStandardMaterial({
        color: 0x3d8bfd,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.set(0, 42, -100);
    mast.add(beam);

    const lookMarker = new THREE.Mesh(
      new THREE.SphereGeometry(6, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8a838 }),
    );
    lookMarker.visible = false;
    scene.add(lookMarker);

    let frameId = 0;
    const tick = () => {
      frameId = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const nw = host.clientWidth || 320;
      const nh = host.clientHeight || 200;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(host);

    apiRef.current = {
      renderer,
      scene,
      camera,
      mesh: null,
      mast,
      beam,
      lookMarker,
      frameId,
    };

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      if (apiRef.current?.mesh) {
        apiRef.current.scene.remove(apiRef.current.mesh);
        apiRef.current.mesh.geometry.dispose();
        (apiRef.current.mesh.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
      apiRef.current = null;
    };
  }, []);

  // Sample DEM grid when station / adapter changes
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !st) {
      setStatus("missing");
      setDetail("Станция не выбрана");
      return;
    }

    let cancelled = false;
    (async () => {
      setStatus("loading");
      const meta = getDemMeta();
      const adapter = getTerrainAdapter();
      if (meta.sourceType === "none" || adapter.id === "none") {
        if (api.mesh) {
          api.scene.remove(api.mesh);
          api.mesh.geometry.dispose();
          (api.mesh.material as THREE.Material).dispose();
          api.mesh = null;
        }
        setStatus("missing");
        setDetail(
          "Данные высот отсутствуют. Загрузите GeoTIFF в панели рельефа.",
        );
        return;
      }

      const samples: (number | null)[] = [];
      for (let iz = 0; iz < GRID; iz++) {
        for (let ix = 0; ix < GRID; ix++) {
          const u = ix / (GRID - 1);
          const v = iz / (GRID - 1);
          const eastM = (u - 0.5) * 2 * HALF_M;
          const northM = (v - 0.5) * 2 * HALF_M;
          const dist = Math.hypot(eastM, northM);
          const brg = (Math.atan2(eastM, northM) * 180) / Math.PI;
          const p = destinationPoint(st.latitude, st.longitude, brg, dist);
          const s = await adapter.sample(p.lat, p.lng);
          samples.push(s.missing ? null : s.elevationM);
        }
      }
      if (cancelled) return;

      const known = samples.filter((x): x is number => x != null);
      if (known.length < GRID) {
        if (api.mesh) {
          api.scene.remove(api.mesh);
          api.mesh.geometry.dispose();
          (api.mesh.material as THREE.Material).dispose();
          api.mesh = null;
        }
        setStatus("missing");
        setDetail(
          `DEM неполный (${known.length}/${GRID * GRID}). Mesh не строится без данных.`,
        );
        return;
      }

      const minE = Math.min(...known);
      const maxE = Math.max(...known);
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
      for (let i = 0; i < pos.count; i++) {
        const e = samples[i];
        const y = e == null ? 0 : e - minE;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      geom.computeVertexNormals();

      if (api.mesh) {
        api.scene.remove(api.mesh);
        api.mesh.geometry.dispose();
        (api.mesh.material as THREE.Material).dispose();
      }
      const mat = new THREE.MeshStandardMaterial({
        color: 0x3a5a48,
        flatShading: true,
        metalness: 0.05,
        roughness: 0.9,
        wireframe: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      api.scene.add(mesh);
      api.mesh = mesh;

      const stationY =
        st.terrainElevationM != null ? st.terrainElevationM - minE : maxE - minE;
      api.mast.position.set(0, stationY, 0);
      const mastH = Math.max(20, Math.min(80, (st.mastHeightM ?? 12) * 2));
      api.mast.scale.set(1, mastH / 40, 1);

      setStatus("ready");
      setDetail(
        `${meta.name} · Δh ${(maxE - minE).toFixed(0)} м · ${GRID}×${GRID}`,
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
  }, [st?.id, st?.latitude, st?.longitude, st?.terrainElevationM, st?.mastHeightM]);

  // Sync beam / look-at marker with pan-tilt
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !st) return;
    api.mast.rotation.y = THREE.MathUtils.degToRad(-az);
    api.beam.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(-el);
    if (lookAt) {
      // Approximate ENU offset meters
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
    <div className={className ?? "relative flex h-full min-h-[160px] flex-col"}>
      <div className="flex items-center justify-between border-b border-ags-border-subtle px-1 py-0.5 text-[10px]">
        <span className="text-ags-dim">3D рельеф</span>
        <span
          className={
            status === "ready"
              ? "text-ags-success"
              : status === "loading"
                ? "text-ags-muted"
                : "text-ags-warning"
          }
        >
          {status === "ready" ? "DEM" : status === "loading" ? "…" : "Н/Д"}
        </span>
      </div>
      <div ref={hostRef} className="relative min-h-0 flex-1">
        {status !== "ready" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ags-bg/70 p-3 text-center text-[11px] text-ags-muted">
            {detail}
          </div>
        )}
      </div>
      {status === "ready" && (
        <p className="truncate px-1 text-[9px] text-ags-dim">{detail}</p>
      )}
    </div>
  );
}
