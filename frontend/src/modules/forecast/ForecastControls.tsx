import { useStore } from "@/state/store";
import { Slider, Select, SectionLabel } from "@/design/primitives";
import { fmtPct, monthLabel } from "@/lib/format";

// Generate a list of month options between two YYYY-MM endpoints (inclusive).
function monthOptions(from: string, to: string): { value: string; label: string }[] {
  const toIdx = (ym: string) => {
    const [y, m] = ym.split("-").map((n) => parseInt(n, 10));
    return y * 12 + (m - 1);
  };
  const toYm = (idx: number) =>
    `${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`;
  const out: { value: string; label: string }[] = [];
  for (let i = toIdx(from); i <= toIdx(to); i++) {
    out.push({ value: toYm(i), label: monthLabel(toYm(i)) });
  }
  return out;
}

const TARGET_DATE_OPTIONS = monthOptions("2026-12", "2028-06");

export function ForecastControls() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const updateActive = useStore((s) => s.updateActive);
  const f = scenario.forecast;
  const b = ds.benchmarks;

  const set = (mut: (f: typeof scenario.forecast) => void) =>
    updateActive((s) => mut(s.forecast));

  const resetToBenchmarks = () =>
    updateActive((s) => {
      s.forecast.screenFailRate = b.avgScreenFailRate;
      s.forecast.perSiteRatePerMonth = b.avgPerSiteRatePerMonth;
      s.forecast.activationMonths = Math.round(b.avgActivationMonths);
    });

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Site plan</SectionLabel>
          <button
            onClick={resetToBenchmarks}
            className="text-xs text-primary hover:text-accent transition-colors font-semibold"
            title={`Screen-fail ${fmtPct(b.avgScreenFailRate * 100)}, rate ${b.avgPerSiteRatePerMonth.toFixed(1)}/mo, activation ${Math.round(b.avgActivationMonths)} mo`}
          >
            Reset to benchmarks
          </button>
        </div>
        <div className="space-y-3.5">
          <Slider
            label="Number of sites"
            value={f.numSites}
            min={1}
            max={80}
            step={1}
            onChange={(v) => set((ff) => { ff.numSites = v; })}
          />
          <Slider
            label="Activation schedule"
            value={f.activationMonths}
            min={1}
            max={12}
            step={1}
            unit=" mo"
            onChange={(v) => set((ff) => { ff.activationMonths = v; })}
          />
        </div>
      </div>

      <div>
        <SectionLabel className="mb-3">Recruitment dynamics</SectionLabel>
        <div className="space-y-3.5">
          <Slider
            label="Screen-fail rate"
            value={Math.round(f.screenFailRate * 100)}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => set((ff) => { ff.screenFailRate = v / 100; })}
          />
          <Slider
            label="Per-site rate / month"
            value={f.perSiteRatePerMonth}
            min={0.5}
            max={4}
            step={0.1}
            unit=" /mo"
            onChange={(v) => set((ff) => { ff.perSiteRatePerMonth = v; })}
          />
          <Slider
            label="Competing-trial drag"
            value={Math.round(f.competingDrag * 100)}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => set((ff) => { ff.competingDrag = v / 100; })}
          />
        </div>
      </div>

      <div>
        <SectionLabel className="mb-3">Target</SectionLabel>
        <div className="space-y-3.5">
          <Slider
            label="Target enrollment"
            value={f.targetEnrollment}
            min={50}
            max={1000}
            step={10}
            onChange={(v) => set((ff) => { ff.targetEnrollment = v; })}
          />
          <div>
            <div className="text-xs text-text-muted mb-1">Last-patient-in target date</div>
            <Select
              value={f.targetDate}
              onChange={(v) => set((ff) => { ff.targetDate = v; })}
              options={TARGET_DATE_OPTIONS}
              className="w-full"
            />
          </div>
          <div className="text-[11px] text-text-faint pt-1">
            Enrollment opens {monthLabel(f.startMonth)}. Curve recomputes live.
          </div>
        </div>
      </div>
    </div>
  );
}
