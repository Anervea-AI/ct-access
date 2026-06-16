import { useStore } from "@/state/store";
import { deriveFunnel } from "@/state/selectors";
import { fmtInt, fmtDelta } from "@/lib/format";
import { cn } from "@/design/primitives";

export function ABCompare() {
  const ds = useStore((s) => s.dataset)!;
  const active = useStore((s) => s.scenarios[s.activeId]);
  const compareId = useStore((s) => s.compareId);
  const compare = useStore((s) => (compareId ? s.scenarios[compareId] : null));

  if (!compare) {
    return (
      <p className="text-sm text-text-muted">
        Pick a second scenario in the <b>Compare</b> selector (top bar) to see eligible-pool and
        constraint deltas side by side.
      </p>
    );
  }

  const a = deriveFunnel(ds, active);
  const b = deriveFunnel(ds, compare);
  const aEnabled = active.criteria.filter((c) => c.enabled).length;
  const bEnabled = compare.criteria.filter((c) => c.enabled).length;
  const delta = a.eligiblePool - b.eligiblePool;

  const Row = ({ label, av, bv, d }: { label: string; av: string; bv: string; d?: number }) => (
    <tr className="border-t border-inset">
      <td className="py-1.5 text-text-muted">{label}</td>
      <td className="py-1.5 text-right font-mono text-ink">{av}</td>
      <td className="py-1.5 text-right font-mono text-ink">{bv}</td>
      <td className={cn("py-1.5 text-right font-mono", d == null ? "text-text-faint" : d >= 0 ? "text-success-text" : "text-error-text")}>
        {d == null ? "" : fmtDelta(d)}
      </td>
    </tr>
  );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="label-caps text-text-subtle">
          <th className="text-left font-semibold py-1"></th>
          <th className="text-right font-semibold py-1 truncate max-w-[8rem]">{active.name}</th>
          <th className="text-right font-semibold py-1 truncate max-w-[8rem]">{compare.name}</th>
          <th className="text-right font-semibold py-1">Δ</th>
        </tr>
      </thead>
      <tbody>
        <Row label="Eligible pool" av={fmtInt(a.eligiblePool)} bv={fmtInt(b.eligiblePool)} d={delta} />
        <Row label="Enabled criteria" av={String(aEnabled)} bv={String(bEnabled)} d={aEnabled - bEnabled} />
        <Row label="Biggest constraint" av={a.biggestConstraintLabel ?? "—"} bv={b.biggestConstraintLabel ?? "—"} />
        <Row label="Protocol" av={active.protocolVersion} bv={compare.protocolVersion} />
      </tbody>
    </table>
  );
}
