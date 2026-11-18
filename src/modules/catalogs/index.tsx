import { MastAntennaPanel } from "./MastAntennaPanel";
import { ComparisonPanel } from "./ComparisonPanel";

export function CatalogsView() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="border-b border-ags-border-subtle px-4 py-2">
        <h1 className="text-sm font-semibold">Мачты, антенны и сравнение</h1>
      </div>
      <div className="min-h-0 flex-1">
        <MastAntennaPanel />
        <ComparisonPanel />
      </div>
    </div>
  );
}
