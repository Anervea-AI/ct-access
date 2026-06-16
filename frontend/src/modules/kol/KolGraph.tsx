import { useMemo } from "react";
import {
  forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation,
  type SimulationLinkDatum, type SimulationNodeDatum,
} from "d3-force";
import type { Kol, KolEdge } from "@/types";

const WIDTH = 720;
const HEIGHT = 520;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

const SEGMENT_FILL: Record<string, string> = {
  established: "#9a3412",
  rising_star: "#c2410c",
  dol: "#ffb74d",
};
const EDGE_COLOR: Record<string, string> = {
  referral: "#2563eb",
  coauthor: "#c2410c",
  coinvestigator: "#ffb74d",
};

interface GNode extends SimulationNodeDatum {
  id: string;
  score: number;
  segment: string;
  name: string;
}
interface GLink extends SimulationLinkDatum<GNode> {
  kind: string;
  weight: number;
}

function clampPos(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function KolGraph({
  nodes, edges, selectedId, onSelect,
}: {
  nodes: Kol[];
  edges: KolEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const layout = useMemo(() => {
    const n = nodes.length || 1;
    const gnodes: GNode[] = nodes.map((k, i) => ({
      id: k.id,
      score: k.score,
      segment: k.segment,
      name: k.name,
      x: CX + 200 * Math.cos((2 * Math.PI * i) / n),
      y: CY + 200 * Math.sin((2 * Math.PI * i) / n),
    }));
    const glinks: GLink[] = edges.map((e) => ({
      source: e.source, target: e.target, kind: e.kind, weight: e.weight,
    }));

    const sim = forceSimulation(gnodes)
      .force("charge", forceManyBody().strength(-200))
      .force("link", forceLink<GNode, GLink>(glinks).id((d) => d.id).distance(72).strength(0.35))
      .force("center", forceCenter(CX, CY))
      .force("collide", forceCollide(20))
      .stop();
    for (let i = 0; i < 320; i++) sim.tick();

    const positioned = gnodes.map((d) => ({
      ...d,
      x: clampPos(d.x ?? CX, 24, WIDTH - 24),
      y: clampPos(d.y ?? CY, 24, HEIGHT - 24),
    }));
    const byId = new Map(positioned.map((d) => [d.id, d]));
    const renderLinks = glinks
      .map((l) => {
        const s = byId.get(typeof l.source === "string" ? l.source : (l.source as GNode).id);
        const t = byId.get(typeof l.target === "string" ? l.target : (l.target as GNode).id);
        return s && t ? { x1: s.x, y1: s.y, x2: t.x, y2: t.y, kind: l.kind, weight: l.weight } : null;
      })
      .filter(Boolean) as { x1: number; y1: number; x2: number; y2: number; kind: string; weight: number }[];
    return { positioned, renderLinks };
  }, [nodes, edges]);

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label="KOL influence network">
        <g>
          {layout.renderLinks.map((l, i) => (
            <line
              key={i}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={EDGE_COLOR[l.kind] ?? "#d9c9ad"}
              strokeWidth={0.6 + l.weight * 1.8}
              strokeOpacity={0.35 + l.weight * 0.3}
            />
          ))}
        </g>
        <g>
          {layout.positioned.map((d) => {
            const r = 6 + d.score * 16;
            const isSel = d.id === selectedId;
            return (
              <g key={d.id} className="cursor-pointer" onClick={() => onSelect(d.id)}>
                {isSel && <circle cx={d.x} cy={d.y} r={r + 4} fill="none" stroke="#7c2d12" strokeWidth={2} />}
                <circle
                  cx={d.x} cy={d.y} r={r}
                  fill={SEGMENT_FILL[d.segment] ?? "#9a3412"}
                  fillOpacity={isSel ? 1 : 0.82}
                  stroke="#ffffff" strokeWidth={1.5}
                >
                  <title>{`${d.name} · score ${d.score.toFixed(2)}`}</title>
                </circle>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-muted mt-2">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#9a3412" }} /> established</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#c2410c" }} /> rising star</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#ffb74d" }} /> DOL</span>
        <span className="ml-2 flex items-center gap-1"><span className="w-4 h-0.5 inline-block" style={{ background: "#2563eb" }} /> referral</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block" style={{ background: "#c2410c" }} /> co-author</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block" style={{ background: "#ffb74d" }} /> co-investigator</span>
      </div>
    </div>
  );
}
