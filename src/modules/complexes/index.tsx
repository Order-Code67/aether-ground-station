import { ComplexesPanel } from "./ComplexesPanel";

export function ComplexesView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ags-border-subtle px-4 py-2">
        <h1 className="text-sm font-semibold">Комплексы и площадки</h1>
        <p className="text-xs text-ags-muted">
          Организация → Комплекс → Площадка → Станция. Фильтр по активному
          комплексу.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ComplexesPanel />
      </div>
    </div>
  );
}

export { ComplexesPanel };
