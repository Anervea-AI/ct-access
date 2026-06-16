// Verify the render-time libraries (topojson + d3-geo + d3-force) actually run
// in this environment with the real us-atlas data — outside React/DOM.
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from "d3-force";
import topo from "us-atlas/states-10m.json" with { type: "json" };

// --- map: topojson -> features -> projection -> path + point ---
const fc = feature(topo, topo.objects.states);
const projection = geoAlbersUsa().fitSize([960, 560], fc);
const path = geoPath(projection);
const d = path(fc.features[5]);
const xy = projection([-81.4, 28.5]); // Orlando-ish
console.log("map: states =", fc.features.length, "| path len =", (d ?? "").length, "| project ok =", !!xy);

// --- d3-force synchronous layout ---
const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, x: Math.cos(i) * 200 + 360, y: Math.sin(i) * 200 + 260 }));
const links = Array.from({ length: 40 }, (_, i) => ({ source: `n${i % 30}`, target: `n${(i * 7 + 3) % 30}` }));
const sim = forceSimulation(nodes)
  .force("charge", forceManyBody().strength(-200))
  .force("link", forceLink(links).id((d) => d.id).distance(72))
  .force("center", forceCenter(360, 260))
  .force("collide", forceCollide(20))
  .stop();
for (let i = 0; i < 320; i++) sim.tick();
const allFinite = nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y));
console.log("force: nodes positioned, all finite =", allFinite, "| sample =", nodes[0].x.toFixed(1), nodes[0].y.toFixed(1));
console.log(allFinite && fc.features.length > 40 && xy ? "LIBS OK" : "LIBS FAILED");
