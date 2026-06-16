import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { deriveKol } from "@/state/selectors";
import { ModuleHeader, AskChip } from "@/app/ModuleHeader";
import { Button, Card, SectionLabel, Kpi, DataTable, cn } from "@/design/primitives";
import { DownloadIcon, NetworkIcon } from "@/design/icons";
import { downloadCsv } from "@/lib/export";
import { fmtScore } from "@/lib/format";
import { KolControls } from "./KolControls";
import { KolGraph } from "./KolGraph";
import { KolProfile } from "./KolProfile";

const SEGMENT_LABEL: Record<string, string> = {
  established: "Established",
  rising_star: "Rising star",
  dol: "DOL",
};

export function Kol() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const graph = useMemo(() => deriveKol(ds, scenario), [ds, scenario]);
  const nodes = graph.nodes;
  const selected = selectedId ? nodes.find((k) => k.id === selectedId) ?? null : null;

  const risingCount = nodes.filter((k) => k.segment === "rising_star").length;
  const dolCount = nodes.filter((k) => k.segment === "dol").length;
  const topKol = nodes[0];

  const tableRows = nodes.slice(0, 12).map((k, i) => [
    i + 1, k.name, SEGMENT_LABEL[k.segment], k.region, fmtScore(k.score),
  ]);

  const exportCsv = () => {
    downloadCsv("kol-ranking.csv", nodes.map((k, i) => ({
      rank: i + 1, name: k.name, segment: k.segment, region: k.region,
      specialty: k.specialty, score: k.score, ...k.signals,
    })));
  };

  return (
    <>
      <ModuleHeader
        code="04"
        priority="P2"
        title="KOL mapping"
        blurb="Who are the influential physicians for this indication — established, rising, and digital? Tune the signal weights; the network and ranking re-sort live."
        actions={
          <>
            <AskChip query="Top 10 rising-star bipolar KOLs in the Midwest by trial activity and social reach" label="Try a query" />
            <Button variant="secondary" onClick={exportCsv}><DownloadIcon /> CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-5">
        <div className="space-y-4">
          <Card>
            <SectionLabel className="mb-3">Signals & filters</SectionLabel>
            <KolControls />
          </Card>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="KOLs shown" value={nodes.length} accent="primary" sub={`${ds.kols.length} total`} />
            <Kpi label="Top KOL" value={topKol ? fmtScore(topKol.score) : "—"} accent="accent" sub={topKol?.name} />
            <Kpi label="Rising stars" value={risingCount} accent="info" />
            <Kpi label="Digital (DOL)" value={dolCount} accent="success" />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5"><NetworkIcon size={15} className="text-accent" /> Influence network</span>
              </SectionLabel>
              <AskChip query="What signals make the top KOL rank highly?" label="Why top?" />
            </div>
            <KolGraph nodes={nodes} edges={graph.edges} selectedId={selectedId} onSelect={setSelectedId} />
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-5">
            <Card>
              <SectionLabel className="mb-3">Ranked KOLs</SectionLabel>
              <div onClick={(e) => {
                const tr = (e.target as HTMLElement).closest("tr");
                if (!tr) return;
                const idx = Array.from(tr.parentElement?.children ?? []).indexOf(tr);
                if (idx >= 0 && nodes[idx]) setSelectedId(nodes[idx].id);
              }}>
                <DataTable columns={["Rank", "KOL", "Segment", "Region", "Score"]} rows={tableRows} />
              </div>
            </Card>

            <Card>
              <SectionLabel className="mb-3">KOL profile</SectionLabel>
              <KolProfile kol={selected} />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
