import { useStore } from "@/state/store";
import { Slider, Select, cn } from "@/design/primitives";
import { titleCase } from "@/lib/format";

const SIGNAL_KEYS = [
  "patientVolume", "referralCentrality", "referralReach",
  "trialLeadership", "trialRecency", "specialtyFit",
];

// real-signal labels (publications/congress/digital are NOT in RWD)
const SIGNAL_LABELS: Record<string, string> = {
  patientVolume: "Patient volume",
  referralCentrality: "Referral centrality",
  referralReach: "Referral reach (PageRank)",
  trialLeadership: "Trial leadership",
  trialRecency: "Trial recency",
  specialtyFit: "Specialty fit",
};

const SEGMENTS = [
  { value: "", label: "All segments" },
  { value: "established", label: "Established" },
  { value: "rising_star", label: "Rising star" },
  { value: "dol", label: "Digital (DOL)" },
];

export function KolControls() {
  const ds = useStore((s) => s.dataset)!;
  const kol = useStore((s) => s.scenarios[s.activeId].kol);
  const updateActive = useStore((s) => s.updateActive);

  const specialties = [...new Set(ds.kols.map((k) => k.specialty))];

  return (
    <div className="space-y-4">
      <div>
        <div className="label-caps text-text-subtle mb-2">Signal weights</div>
        <div className="space-y-2.5">
          {SIGNAL_KEYS.map((key) => (
            <Slider
              key={key}
              label={SIGNAL_LABELS[key] ?? titleCase(key)}
              value={Math.round((kol.weights[key] ?? 0) * 100)}
              min={0}
              max={100}
              step={5}
              unit="%"
              onChange={(v) => updateActive((s) => { s.kol.weights[key] = v / 100; })}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2 border-t border-inset pt-3">
        <div>
          <div className="label-caps text-text-subtle mb-1">Segment</div>
          <Select
            value={kol.segment ?? ""}
            onChange={(v) => updateActive((s) => { s.kol.segment = v || null; })}
            options={SEGMENTS}
            className="w-full"
          />
        </div>
        <div>
          <div className="label-caps text-text-subtle mb-1">Region</div>
          <Select
            value={kol.region ?? ""}
            onChange={(v) => updateActive((s) => { s.kol.region = v || null; })}
            options={[{ value: "", label: "All regions" }, ...ds.regions.map((r) => ({ value: r, label: r }))]}
            className="w-full"
          />
        </div>
        <div>
          <div className="label-caps text-text-subtle mb-1">Specialty</div>
          <Select
            value={kol.specialty ?? ""}
            onChange={(v) => updateActive((s) => { s.kol.specialty = v || null; })}
            options={[{ value: "", label: "All specialties" }, ...specialties.map((sp) => ({ value: sp, label: sp }))]}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
