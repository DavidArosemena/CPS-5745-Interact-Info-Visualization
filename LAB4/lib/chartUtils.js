// Helper functions for the data visualization app.
// Everything here is plain JavaScript, so it is easy to test and reuse.

export const SAMPLE_NAME = "Kean fall 2025 headcount by college (sample)";

export const SAMPLE_CSV = `College,Undergraduate,Graduate,Doctoral,Total
CBPM,5351,386,0,5737
HCSMT,3699,148,2,3849
CLA,3305,253,0,3558
CHPHS,1211,820,134,2165
COE,941,466,167,1574
SVPAA,864,128,0,992
MGC,831,75,0,906
`;

// Pick the delimiter (comma, semicolon, or tab) that appears most in the header line.
export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== "") || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  return Object.keys(counts).reduce(
    (best, d) => (counts[d] > counts[best] ? d : best),
    ","
  );
}

// Split text into rows of fields. Handles quoted fields, doubled quotes, and CRLF line endings.
export function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Turn CSV text into { columns: [names], records: [[cells]] }.
export function parseTable(text) {
  const delimiter = detectDelimiter(text);
  const rows = parseRows(text, delimiter);
  if (rows.length === 0) return { columns: [], records: [] };

  const width = Math.max(...rows.map((r) => r.length));
  const seen = {};
  const columns = [];
  for (let i = 0; i < width; i += 1) {
    let name = ((rows[0][i] || "") + "").trim() || `Column ${i + 1}`;
    if (seen[name]) {
      seen[name] += 1;
      name = `${name} (${seen[name]})`;
    } else {
      seen[name] = 1;
    }
    columns.push(name);
  }
  const records = rows
    .slice(1)
    .map((r) => Array.from({ length: width }, (_, i) => ((r[i] ?? "") + "").trim()));
  return { columns, records };
}

// Read a number from text such as "1,234", "$5.50", "12%", or "(40)". Returns NaN if it is not a number.
export function parseNumber(value) {
  if (value === undefined || value === null) return NaN;
  let s = String(value).trim();
  if (s === "") return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$€£%\s,]/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  const n = Number(s);
  return negative ? -n : n;
}

// A column counts as numeric when at least 80% of its non-empty cells are numbers.
export function numericColumnIndexes(records, width) {
  const result = [];
  for (let col = 0; col < width; col += 1) {
    let filled = 0;
    let numeric = 0;
    for (const row of records) {
      const cell = row[col];
      if (cell !== undefined && cell !== "") {
        filled += 1;
        if (Number.isFinite(parseNumber(cell))) numeric += 1;
      }
    }
    if (filled > 0 && numeric / filled >= 0.8) result.push(col);
  }
  return result;
}

// Build the list of { label, value } pairs to draw. Rows with no usable number are skipped.
export function buildSeries(records, xIdx, yIdx) {
  return records
    .map((row, i) => ({
      label: row[xIdx] || `Row ${i + 1}`,
      value: parseNumber(row[yIdx]),
    }))
    .filter((p) => Number.isFinite(p.value));
}

function niceNum(range, round) {
  const exp = Math.floor(Math.log10(range));
  const frac = range / Math.pow(10, exp);
  let nice;
  if (round) {
    nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  } else {
    nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  }
  return nice * Math.pow(10, exp);
}

// Round axis limits to friendly numbers and return the tick values.
export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { ticks: [0, 1], min: 0, max: 1 };
  }
  if (min === max) {
    if (min === 0) {
      max = 1;
    } else {
      const pad = Math.abs(min) * 0.1;
      min -= pad;
      max += pad;
    }
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / (count - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const steps = Math.round((niceMax - niceMin) / step);
  const ticks = [];
  for (let i = 0; i <= steps; i += 1) {
    ticks.push(Number((niceMin + i * step).toFixed(10)));
  }
  return { ticks, min: niceMin, max: niceMax };
}

export function formatNumber(value, compact = false) {
  const abs = Math.abs(value);
  if (compact && abs >= 10000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  }).format(value);
}

export function shorten(text, max) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

// ---------- Extra helpers for sorting, summaries, colors, and percentages ----------

// Applies "top N" (largest N values) and then the chosen sort order.
// sort: "original" | "desc" | "asc"   topN: 0 means show everything
export function sortAndLimit(series, sort, topN) {
  let rows = series.map((p, i) => ({ ...p, order: i }));
  if (topN > 0 && rows.length > topN) {
    rows = [...rows].sort((a, b) => b.value - a.value || a.order - b.order).slice(0, topN);
    rows.sort((a, b) => a.order - b.order);
  }
  if (sort === "desc") rows.sort((a, b) => b.value - a.value || a.order - b.order);
  if (sort === "asc") rows.sort((a, b) => a.value - b.value || a.order - b.order);
  return rows;
}

// Total, average, highest, and lowest for the summary cards.
export function summarize(series) {
  if (!series.length) return null;
  let total = 0;
  let hi = series[0];
  let lo = series[0];
  for (const p of series) {
    total += p.value;
    if (p.value > hi.value) hi = p;
    if (p.value < lo.value) lo = p;
  }
  return { count: series.length, total, average: total / series.length, highest: hi, lowest: lo };
}

export function formatPercent(fraction) {
  const pct = fraction * 100;
  const abs = Math.abs(pct);
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: abs > 0 && abs < 10 ? 1 : 0,
  }).format(pct)}%`;
}

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const n = parseInt(m ? m[1] : "087e8b", 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

// Builds n distinguishable colors starting from the chosen base color.
export function makePalette(baseHex, n) {
  const { h, s, l } = hexToHsl(baseHex);
  const sat = Math.round(Math.min(0.85, Math.max(0.45, s)) * 100);
  const light = Math.round(Math.min(0.55, Math.max(0.38, l)) * 100);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const hue = Math.round((h + i * 47) % 360);
    const lt = Math.min(50, light + (i % 2 === 0 ? 0 : 6));
    out.push(i === 0 ? baseHex : `hsl(${hue} ${sat}% ${lt}%)`);
  }
  return out;
}

// Points for a scatter plot: two numeric columns, labeled by the first text column.
export function buildScatter(records, xIdx, yIdx, labelIdx) {
  const out = [];
  records.forEach((row, i) => {
    const x = parseNumber(row[xIdx]);
    const y = parseNumber(row[yIdx]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const label = labelIdx >= 0 && row[labelIdx] ? row[labelIdx] : `Row ${i + 1}`;
      out.push({ label, x, y });
    }
  });
  return out;
}

// Groups the smallest slices into one "Other" slice so pie charts stay readable.
export function groupForPie(series, maxSlices = 8) {
  const positive = series.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  if (positive.length <= maxSlices) return positive;
  const head = positive.slice(0, maxSlices - 1);
  const rest = positive.slice(maxSlices - 1);
  const otherValue = rest.reduce((sum, p) => sum + p.value, 0);
  return [...head, { label: `Other (${rest.length})`, value: otherValue }];
}

// Pearson correlation between x and y for scatter plots (null if it cannot be computed).
export function correlation(points) {
  const n = points.length;
  if (n < 3) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}