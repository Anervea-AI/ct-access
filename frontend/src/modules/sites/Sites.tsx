import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { deriveFunnel, deriveSites } from "@/state/selectors";
import { ModuleHeader, AskChip } from "@/app/ModuleHeader";
import { Button, Card, Callout, Kpi, SectionLabel, cn } from "@/design/primitives";
import { DownloadIcon } from "@/design/icons";
import { fmtInt, fmtScore } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { SitesToolbar } from "./SitesToolbar";
import { SiteLeaderboard } from "./SiteLeaderboard";
import { SiteDetail } from "./SiteDetail";
import { DiversityBars } from "./DiversityBars";
import { UntappedPIsPanel, WhitespaceInsight } from "@/modules/insights/InsightPanels";
import { SiteHcpMap } from "@/modules/networkmap/SiteHcpMap";
import { HcpProfileCard } from "@/modules/networkmap/HcpProfileCard";

export function Sites() {
  const ds = useStore((s) => s.dataset)!;
  const scenario = useStore((s) => s.scenarios[s.activeId]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHcpNpi, setSelectedHcpNpi] = useState<number | null>(null);
  const [shortlist, setShortlist] = useState<Set<string>>(new Set());

  // selecting a site (map / leaderboard / shortlist) clears any HCP shown in the scorecard
  const selectSite = (id: string | null) => { setSelectedId(id); setSelectedHcpNpi(null); };

  const ranking = useMemo(() => deriveSites(ds, scenario), [ds, scenario]);
  const eligiblePool = useMemo(() => deriveFunnel(ds, scenario).eligiblePool, [ds, scenario]);

  const sites = ranking.sites;
  const totalEligible = useMemo(() => sites.reduce((acc, s) => acc + s.eligiblePatients, 0), [sites]);
  const avgScore = sites.length ? sites.reduce((acc, s) => acc + s.score, 0) / sites.length : 0;

  const rankById = useMemo(() => {
    const m = new Map<string, number>();
    sites.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [sites]);

  const selected = selectedId ? sites.find((s) => s.id === selectedId) ?? null : null;
  const shortlistSites = sites.filter((s) => shortlist.has(s.id));

  const toggleShortlist = (id: string) =>
    setShortlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportShortlist = () => {
    const rows = shortlistSites.map((s) => ({
      rank: rankById.get(s.id) ?? "",
      site: s.name,
      state: s.state,
      region: s.region,
      eligiblePatients: s.eligiblePatients,
      piExperienceTrials: s.piExperienceTrials,
      indicationRxVolume: s.indicationRxVolume,
      competingTrials: s.competingTrials,
      score: s.score,
      diversityFit: s.diversityFit,
      blackPct: s.demographics.blackPct,
      hispanicPct: s.demographics.hispanicPct,
      femalePct: s.demographics.femalePct,
      ruralPct: s.demographics.ruralPct,
      specialties: s.specialties.join("; "),
      definitions: "score = weighted catchment/experience/Rx − competing drag + diversity fit; eligiblePatients = baseShare × eligible pool × catchment factor",
    }));
    downloadCsv("site-shortlist-rationale.csv", rows);
  };

  const exportLeaderboard = () => {
    downloadCsv(
      "site-leaderboard.csv",
      sites.map((s, i) => ({
        rank: i + 1, site: s.name, region: s.region, state: s.state,
        eligiblePatients: s.eligiblePatients, piExperienceTrials: s.piExperienceTrials,
        indicationRxVolume: s.indicationRxVolume, competingTrials: s.competingTrials,
        score: s.score, diversityFit: s.diversityFit,
      })),
    );
  };

  return (
    <>
      <ModuleHeader
        code="01"
        priority="Demo"
        title="Site & PI identification"
        blurb="Where should we run, and which PIs can deliver? Tune catchment, supply and diversity targets — the leaderboard, map and representativeness recompute live."
        actions={
          <>
            <AskChip query="Sites in the Southeast with 150+ eligible patients and above-average Black and Hispanic representation" label="Try a query" />
            <Button variant="secondary" onClick={exportLeaderboard}><DownloadIcon /> CSV</Button>
          </>
        }
      />

      <SitesToolbar />

      {/* Results — full width (filters now live in the sticky toolbar above) */}
      <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Eligible pool" value={fmtInt(eligiblePool)} accent="primary" sub="from feasibility cascade" />
            <Kpi label="Sites matching" value={sites.length} accent="accent" sub={`of ${ds.sites.length} total`} />
            <Kpi label="Eligible across sites" value={fmtInt(totalEligible)} accent="info" sub="summed over matches" />
            <Kpi label="Avg score" value={fmtScore(avgScore)} accent="success" sub="0–1 weighted blend" />
          </div>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Geographic footprint — sites, HCPs & referral network</SectionLabel>
              <AskChip query="Which high-volume HCPs sit within 50 miles of my top site?" label="Ask" />
            </div>
            <SiteHcpMap
              sites={sites}
              radiusMiles={scenario.siteFilters.catchmentRadiusMiles}
              regions={scenario.siteFilters.regions}
              onSiteSelected={selectSite}
              onHcpSelected={setSelectedHcpNpi}
              focusHcpNpi={selectedHcpNpi}
            />
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Site leaderboard</SectionLabel>
                <AskChip query="Why is the top site ranked above the others?" label="Why this order?" />
              </div>
              <SiteLeaderboard
                sites={sites}
                selectedId={selectedId}
                onSelect={selectSite}
                shortlist={shortlist}
                onToggleShortlist={toggleShortlist}
              />
            </Card>

            <Card>
              <SectionLabel className="mb-3">{selectedHcpNpi != null ? "HCP profile" : "Site scorecard"}</SectionLabel>
              {selectedHcpNpi != null ? (
                <HcpProfileCard
                  npi={selectedHcpNpi}
                  onSelectHcp={setSelectedHcpNpi}
                  onClose={() => setSelectedHcpNpi(null)}
                />
              ) : (
                <SiteDetail
                  site={selected}
                  rank={selected ? rankById.get(selected.id) ?? null : null}
                  inShortlist={selected ? shortlist.has(selected.id) : false}
                  onToggleShortlist={toggleShortlist}
                />
              )}
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Diversity representativeness</SectionLabel>
              <AskChip query="How does my selected-site representativeness compare to disease prevalence, and which sites improve it?" label="Ask" />
            </div>
            <DiversityBars
              representativeness={ranking.representativeness}
              diseaseDistribution={ranking.diseaseDistribution}
            />
          </Card>

          {/* New-insight panels (real RWD) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Untapped high-volume PIs</SectionLabel>
                <AskChip query="Which high-volume providers have never run a trial, and where are they?" label="Ask" />
              </div>
              <UntappedPIsPanel limit={10} />
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Geographic whitespace</SectionLabel>
                <AskChip query="Which high-density states have no site, and would expanding there improve diversity?" label="Ask" />
              </div>
              <WhitespaceInsight limit={8} />
            </Card>
          </div>

          {/* Shortlist builder */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Shortlist builder</SectionLabel>
              <div className="flex items-center gap-2">
                <AskChip query="Draft a rationale for shortlisting these sites for the steering committee" label="Draft rationale" />
                <Button
                  variant="secondary"
                  onClick={exportShortlist}
                  disabled={!shortlistSites.length}
                >
                  <DownloadIcon /> Export rationale
                </Button>
              </div>
            </div>
            {!shortlistSites.length ? (
              <Callout variant="info" title="No sites shortlisted yet">
                Add candidates with the <b>Shortlist</b> action in the leaderboard or scorecard to
                compare them side by side and export an export-ready rationale.
              </Callout>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="bg-muted text-text-subtle label-caps text-left px-3 py-2">Site</th>
                      <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Eligible</th>
                      <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">PI trials</th>
                      <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Rx volume</th>
                      <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Competing</th>
                      <th className="bg-muted text-text-subtle label-caps text-right px-3 py-2">Score</th>
                      <th className="bg-muted px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {shortlistSites.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => selectSite(s.id)}
                        className={cn(
                          "border-t border-inset cursor-pointer transition-colors",
                          s.id === selectedId ? "bg-primary/5" : "hover:bg-muted/60",
                        )}
                      >
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-primary">{s.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-ink">{fmtInt(s.eligiblePatients)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-ink">{s.piExperienceTrials}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-ink">{fmtInt(s.indicationRxVolume)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-ink">{s.competingTrials}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-mono font-semibold text-primary">{fmtScore(s.score)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleShortlist(s.id); }}
                            className="text-xs text-text-muted hover:text-error-text font-semibold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
    </>
  );
}
