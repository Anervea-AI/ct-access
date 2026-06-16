// Client-side exports: CSV (data), PNG/SVG (charts), per PRD §6.3. PDF is server-side.

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  download(blob, filename);
}

/** Serialize an <svg> element and download it. */
export function downloadSvg(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const data = new XMLSerializer().serializeToString(clone);
  download(new Blob([data], { type: "image/svg+xml;charset=utf-8" }), filename);
}

/** Rasterize an <svg> element to PNG via canvas. */
export function downloadSvgAsPng(svg: SVGSVGElement, filename: string, scale = 2): void {
  const rect = svg.getBoundingClientRect();
  const w = rect.width || 800;
  const h = rect.height || 400;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const data = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const svgUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => blob && download(blob, filename), "image/png");
  };
  img.src = svgUrl;
}

/** Find the first <svg> inside a container and export it as PNG. */
export function exportContainerPng(container: HTMLElement | null, filename: string): void {
  const svg = container?.querySelector("svg") as SVGSVGElement | null;
  if (svg) downloadSvgAsPng(svg, filename);
}
