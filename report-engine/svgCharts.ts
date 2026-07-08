/**
 * Chart rendering, ported from charts.py.
 * Deliberately implemented as plain SVG strings (not Chart.js / canvas)
 * so the production PDF pipeline has zero runtime chart dependency and
 * renders identically wherever Chromium runs it. SVG also stays crisp
 * at any zoom or print DPI, which a rasterized PNG chart cannot.
 */
import { ChartSpec, SwotSpec } from "./types.js";
import { GOLD, GREEN, RED, INK, GREY, MIST, LINE } from "./theme.js";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------------------
// Radar chart
// ---------------------------------------------------------------------------
export function radarChart(labels: string[], values: number[], size = 320): string {
  const n = labels.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const ringPolys = [0.25, 0.5, 0.75, 1].map((frac) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const a = angleFor(i);
      return `${cx + Math.cos(a) * r * frac},${cy + Math.sin(a) * r * frac}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="${LINE}" stroke-width="1"/>`;
  }).join("");

  const spokes = Array.from({ length: n }, (_, i) => {
    const a = angleFor(i);
    return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * r}" y2="${cy + Math.sin(a) * r}" stroke="${LINE}" stroke-width="1"/>`;
  }).join("");

  const dataPts = values
    .map((v, i) => {
      const a = angleFor(i);
      const rad = r * (Math.max(0, Math.min(100, v)) / 100);
      return `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`;
    })
    .join(" ");

  const labelEls = labels
    .map((label, i) => {
      const a = angleFor(i);
      const lx = cx + Math.cos(a) * (r + 26);
      const ly = cy + Math.sin(a) * (r + 26);
      const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
      return `<text x="${lx}" y="${ly}" font-size="12" font-weight="700" fill="${INK}" text-anchor="${anchor}" dominant-baseline="middle">${esc(label)}</text>`;
    })
    .join("");

  return `
  <svg viewBox="0 0 ${size} ${size + 20}" width="100%" xmlns="http://www.w3.org/2000/svg">
    ${ringPolys}
    ${spokes}
    <polygon points="${dataPts}" fill="${GOLD}" fill-opacity="0.28" stroke="${GOLD}" stroke-width="2.2"/>
    ${labelEls}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Horizontal bar chart
// ---------------------------------------------------------------------------
export function barChart(
  labels: string[],
  values: number[],
  accent = GOLD,
  width = 620
): string {
  const rowH = 30;
  const height = labels.length * rowH + 10;
  const labelW = 190;
  const trackW = width - labelW - 50;

  const rows = labels
    .map((label, i) => {
      const y = i * rowH + 6;
      const v = Math.max(0, Math.min(100, values[i]));
      const barW = (v / 100) * trackW;
      return `
      <text x="${labelW - 10}" y="${y + 15}" font-size="12" fill="${INK}" text-anchor="end">${esc(label)}</text>
      <rect x="${labelW}" y="${y}" width="${trackW}" height="16" rx="3" fill="#EDEDEA"/>
      <rect x="${labelW}" y="${y}" width="${barW}" height="16" rx="3" fill="${accent}"/>
      <text x="${labelW + barW + 8}" y="${y + 13}" font-size="12" font-weight="700" fill="${INK}">${v}</text>`;
    })
    .join("");

  return `
  <svg viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg">
    ${rows}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Pie chart
// ---------------------------------------------------------------------------
export function pieChart(
  labels: string[],
  values: number[],
  colors: string[] = [GOLD, "#EDEDEA", GREY, GREEN],
  size = 260
): string {
  const total = values.reduce((a, b) => a + b, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  let angle = -Math.PI / 2;

  const slices = values
    .map((v, i) => {
      const frac = v / total;
      const start = angle;
      const end = angle + frac * 2 * Math.PI;
      angle = end;
      const x1 = cx + Math.cos(start) * r;
      const y1 = cy + Math.sin(start) * r;
      const x2 = cx + Math.cos(end) * r;
      const y2 = cy + Math.sin(end) * r;
      const large = frac > 0.5 ? 1 : 0;
      const mid = start + (end - start) / 2;
      const lx = cx + Math.cos(mid) * r * 0.62;
      const ly = cy + Math.sin(mid) * r * 0.62;
      return `
      <path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${colors[i % colors.length]}" stroke="white" stroke-width="2"/>
      <text x="${lx}" y="${ly}" font-size="13" font-weight="700" fill="white" text-anchor="middle">${Math.round(frac * 100)}%</text>`;
    })
    .join("");

  const legend = labels
    .map((label, i) => {
      const ly = size + 18 + i * 18;
      return `
      <rect x="0" y="${ly - 10}" width="10" height="10" fill="${colors[i % colors.length]}"/>
      <text x="16" y="${ly - 1}" font-size="11" fill="${INK}">${esc(label)}</text>`;
    })
    .join("");

  return `
  <svg viewBox="0 0 ${size} ${size + labels.length * 18 + 14}" width="100%" xmlns="http://www.w3.org/2000/svg">
    ${slices}
    ${legend}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Matrix chart (risk matrix / priority matrix) — scatter with quadrants
// ---------------------------------------------------------------------------
export function matrixChart(
  points: { label: string; x: number; y: number }[],
  xLabel: string,
  yLabel: string,
  variant: "risk" | "priority",
  size = 420
): string {
  const pad = 40;
  const plot = size - pad * 2;
  const toX = (x: number) => pad + (x / 100) * plot;
  const toY = (y: number) => pad + plot - (y / 100) * plot;

  const quadrants =
    variant === "risk"
      ? `<rect x="${pad + plot / 2}" y="${pad}" width="${plot / 2}" height="${plot / 2}" fill="#FBEAEA"/>
         <rect x="${pad}" y="${pad + plot / 2}" width="${plot / 2}" height="${plot / 2}" fill="#EAF3EC"/>`
      : `<rect x="${pad + plot / 2}" y="${pad}" width="${plot / 2}" height="${plot / 2}" fill="#EAF3EC"/>
         <rect x="${pad}" y="${pad + plot / 2}" width="${plot / 2}" height="${plot / 2}" fill="#F5F5F3"/>
         <rect x="${pad + plot / 2}" y="${pad + plot / 2}" width="${plot / 2}" height="${plot / 2}" fill="#FBEAEA"/>`;

  const dots = points
    .map((p, i) => {
      const px = toX(p.x);
      const py = toY(p.y);
      let color = GOLD;
      if (variant === "risk") {
        color = p.x >= 50 && p.y >= 50 ? RED : p.x >= 50 || p.y >= 50 ? GOLD : GREEN;
      }
      const above = i % 2 === 0;
      const ty = above ? py - 14 : py + 20;
      return `
      <circle cx="${px}" cy="${py}" r="9" fill="${color}" stroke="${INK}" stroke-width="1.1"/>
      <rect x="${px - p.label.length * 3.2 - 3}" y="${ty - 11}" width="${p.label.length * 6.4 + 6}" height="14" rx="3" fill="white" fill-opacity="0.85"/>
      <text x="${px}" y="${ty}" font-size="10.5" font-weight="700" fill="${INK}" text-anchor="middle">${esc(p.label)}</text>`;
    })
    .join("");

  return `
  <svg viewBox="0 0 ${size} ${size}" width="100%" xmlns="http://www.w3.org/2000/svg">
    ${quadrants}
    <line x1="${pad}" y1="${pad + plot / 2}" x2="${pad + plot}" y2="${pad + plot / 2}" stroke="${LINE}"/>
    <line x1="${pad + plot / 2}" y1="${pad}" x2="${pad + plot / 2}" y2="${pad + plot}" stroke="${LINE}"/>
    <rect x="${pad}" y="${pad}" width="${plot}" height="${plot}" fill="none" stroke="${LINE}"/>
    ${dots}
    <text x="${pad + plot / 2}" y="${size - 10}" font-size="11" fill="${GREY}" text-anchor="middle">${esc(xLabel)}</text>
    <text x="14" y="${pad + plot / 2}" font-size="11" fill="${GREY}" text-anchor="middle" transform="rotate(-90 14 ${pad + plot / 2})">${esc(yLabel)}</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
export function timelineChart(
  milestones: { period: string; title: string }[],
  accent = GOLD,
  width = 620
): string {
  const height = 110;
  const n = milestones.length;
  const marginX = 50;
  const step = (width - marginX * 2) / (n - 1 || 1);

  const items = milestones
    .map((m, i) => {
      const x = marginX + i * step;
      return `
      <circle cx="${x}" cy="${height / 2}" r="15" fill="${accent}" stroke="${INK}" stroke-width="1.2"/>
      <text x="${x}" y="${height / 2 + 5}" font-size="12" font-weight="700" fill="white" text-anchor="middle">${i + 1}</text>
      <text x="${x}" y="${height / 2 - 26}" font-size="13" font-weight="700" fill="${INK}" text-anchor="middle">${esc(m.period)}</text>
      <text x="${x}" y="${height / 2 + 34}" font-size="10.5" fill="#4A4A4A" text-anchor="middle">${esc(m.title)}</text>`;
    })
    .join("");

  return `
  <svg viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg">
    <line x1="${marginX}" y1="${height / 2}" x2="${width - marginX}" y2="${height / 2}" stroke="${LINE}" stroke-width="3"/>
    ${items}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Dispatcher — turns a ChartSpec into markup, used by the page renderer
// ---------------------------------------------------------------------------
export function renderChart(spec: ChartSpec): string {
  switch (spec.type) {
    case "radar":
      return radarChart(spec.labels, spec.values);
    case "bar":
      return barChart(spec.labels, spec.values, spec.accent);
    case "pie":
      return pieChart(spec.labels, spec.values, spec.colors);
    case "matrix":
      return matrixChart(spec.points, spec.xLabel, spec.yLabel, spec.variant);
    case "timeline":
      return timelineChart(spec.milestones);
    default:
      return "";
  }
}
