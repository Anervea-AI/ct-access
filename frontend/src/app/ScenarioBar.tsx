import { useStore } from "@/state/store";
import { Button, Select, cn } from "@/design/primitives";
import { CopyIcon, PlusIcon } from "@/design/icons";

export function ScenarioBar() {
  const scenarios = useStore((s) => s.scenarios);
  const order = useStore((s) => s.order);
  const activeId = useStore((s) => s.activeId);
  const compareId = useStore((s) => s.compareId);
  const setActive = useStore((s) => s.setActive);
  const setCompare = useStore((s) => s.setCompare);
  const duplicateActive = useStore((s) => s.duplicateActive);
  const createScenario = useStore((s) => s.createScenario);

  const opts = order.map((id) => ({ value: id, label: scenarios[id].name }));

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="label-caps text-text-subtle">Scenario</span>
      <Select value={activeId} onChange={setActive} options={opts} />
      <button
        title="Duplicate scenario"
        onClick={() => duplicateActive()}
        className="p-1.5 rounded-md text-text-muted hover:bg-hover hover:text-primary"
      >
        <CopyIcon />
      </button>
      <button
        title="New scenario"
        onClick={() => createScenario()}
        className="p-1.5 rounded-md text-text-muted hover:bg-hover hover:text-primary"
      >
        <PlusIcon />
      </button>
      <div className="flex items-center gap-1 ml-2">
        <span className="label-caps text-text-subtle">Compare</span>
        <Select
          value={compareId ?? ""}
          onChange={(v) => setCompare(v || null)}
          options={[{ value: "", label: "— none —" }, ...opts.filter((o) => o.value !== activeId)]}
        />
      </div>
    </div>
  );
}
