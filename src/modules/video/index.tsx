import { useState } from "react";
import { VideoPanel } from "./VideoPanel";
import { WalksnailPanel } from "@/modules/walksnail/WalksnailPanel";

type LayoutMode = "1" | "2" | "4";

/**
 * GS-7 Video Center — multi-tile layouts; honest Live only with frames.
 * WebRTC media hidden until PASS. Walksnail as source tab.
 */
export function VideoView() {
  const [layout, setLayout] = useState<LayoutMode>("1");
  const [tab, setTab] = useState<"sources" | "walksnail">("sources");

  const tiles =
    layout === "1" ? 1 : layout === "2" ? 2 : 4;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="video-center">
      <div className="flex flex-wrap items-center gap-2 border-b border-ags-border-subtle px-4 py-2">
        <div>
          <h1 className="text-sm font-semibold">Видеоцентр</h1>
          <p className="text-xs text-ags-muted">
            UVC / RTSP / Walksnail · Connecting / Live / No Signal / No Device /
            Error. Без фейкового Live. WebRTC media скрыт.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {(
            [
              ["sources", "Источники"],
              ["walksnail", "Walksnail"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                tab === id
                  ? "rounded bg-ags-accent px-2 py-1 text-xs text-white"
                  : "rounded border border-ags-border px-2 py-1 text-xs"
              }
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          {tab === "sources" &&
            (["1", "2", "4"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={
                  layout === m
                    ? "rounded bg-ags-elevated px-2 py-1 text-xs text-ags-accent"
                    : "rounded border border-ags-border px-2 py-1 text-xs"
                }
                onClick={() => setLayout(m)}
              >
                {m}×
              </button>
            ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {tab === "walksnail" ? (
          <WalksnailPanel />
        ) : (
          <div
            className={
              tiles === 1
                ? "grid h-full min-h-0 grid-cols-1 gap-2"
                : tiles === 2
                  ? "grid h-full min-h-0 grid-cols-1 gap-2 md:grid-cols-2"
                  : "grid h-full min-h-0 grid-cols-1 gap-2 md:grid-cols-2 md:grid-rows-2"
            }
          >
            {Array.from({ length: tiles }, (_, i) => (
              <div
                key={i}
                className="min-h-0 overflow-hidden rounded border border-ags-border bg-ags-panel"
              >
                <VideoPanel tileId={`tile-${i}`} compact={tiles > 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { VideoPanel } from "./VideoPanel";
