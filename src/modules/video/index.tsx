import { VideoPanel } from "./VideoPanel";

/** GS-7 Video Center — UVC/RTSP/Walksnail через существующие адаптеры; без fake Live. */
export function VideoView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ags-border-subtle px-4 py-2">
        <h1 className="text-sm font-semibold">Видеоцентр</h1>
        <p className="text-xs text-ags-muted">
          Источники, запись и статусы Connecting / Live / No Signal / No Device /
          Error. WebRTC media — не готов. Walksnail и архив — соседние вкладки.
        </p>
      </div>
      <div className="min-h-0 flex-1 p-2">
        <VideoPanel />
      </div>
    </div>
  );
}

export { VideoPanel } from "./VideoPanel";
