import { useState } from "react";
import {
  exportComplexReportPdf,
  fetchComplexReportJson,
} from "@/services/inventory";
import { exportTelemetryCsv } from "@/services/telemetry/normalize";
import { eventBus } from "@/services/events/eventBus";

export function ReportsView() {
  const [json, setJson] = useState<string>("");
  const [pdfNote, setPdfNote] = useState<string | null>(null);

  const load = async () => {
    const report = await fetchComplexReportJson();
    setJson(report);
    eventBus.emit("info", "reports", "Сформирован JSON-отчёт комплекса");
  };

  const pdf = async () => {
    try {
      const res = await exportComplexReportPdf();
      setPdfNote(`${res.message} (${res.bytes} bytes)`);
      eventBus.emit("info", "reports", res.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPdfNote(msg);
      eventBus.emit("warning", "reports", msg);
    }
  };

  const download = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6 text-sm">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-xs text-ags-muted">
          JSON / CSV / PDF из локального SQLite (без фиктивных метрик).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-ags-accent px-3 py-1.5 text-white"
          onClick={() => void load()}
        >
          Отчёт комплекса (JSON)
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5"
          onClick={() => void pdf()}
        >
          PDF на диск
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5"
          disabled={!json}
          onClick={() =>
            download(json, `ags-report-${Date.now()}.json`, "application/json")
          }
        >
          Скачать JSON
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5"
          onClick={() => {
            const csv = exportTelemetryCsv([]);
            download(csv, `ags-telemetry-empty-${Date.now()}.csv`, "text/csv");
            eventBus.emit(
              "info",
              "reports",
              "CSV шаблон телеметрии (пустая история сессии)",
            );
          }}
        >
          CSV шаблон телеметрии
        </button>
      </div>
      {pdfNote && <p className="text-xs text-ags-warning">{pdfNote}</p>}
      {json && (
        <pre className="max-h-[50vh] overflow-auto rounded border border-ags-border bg-ags-elevated p-3 font-mono text-[11px]">
          {json}
        </pre>
      )}
    </div>
  );
}
