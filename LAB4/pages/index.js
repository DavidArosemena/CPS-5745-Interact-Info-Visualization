import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./index.module.css";
import Chart from "../components/Charts";
import {
  SAMPLE_CSV,
  SAMPLE_NAME,
  buildScatter,
  buildSeries,
  correlation,
  formatNumber,
  formatPercent,
  groupForPie,
  makePalette,
  numericColumnIndexes,
  parseTable,
  sortAndLimit,
  summarize,
} from "../lib/chartUtils";

const STUDENT_NAME = "David Arosemena";
const MAX_BARS = 30;
const MAX_POINTS = 1000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_AI_REQUESTS = 8;

const COLOR_THEMES = [
  { id: "cyan", name: "Cyan", color: "#22d3ee" },
  { id: "violet", name: "Violet", color: "#8b5cf6" },
  { id: "magenta", name: "Magenta", color: "#f43f8e" },
  { id: "lime", name: "Lime", color: "#a3e635" },
  { id: "amber", name: "Amber", color: "#fbbf24" },
  { id: "blue", name: "Blue", color: "#3b82f6" },
];

const CHART_TYPES = [
  { id: "bar", name: "Bar chart" },
  { id: "line", name: "Line chart" },
  { id: "pie", name: "Pie chart" },
  { id: "donut", name: "Donut chart" },
  { id: "scatter", name: "Scatter plot" },
];

// Counts a number up from zero, so the summary cards feel alive.
function CountUp({ value }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const reduce =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{formatNumber(shown)}</>;
}

function StatCard({ label, value, sub, delay }) {
  return (
    <div className={styles.stat} style={{ animationDelay: `${delay || 0}ms` }}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>
        <CountUp value={value} />
      </div>
      {sub && (
        <div className={styles.statSub} title={sub}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [table, setTable] = useState(null);
  const [sourceName, setSourceName] = useState("");
  const [error, setError] = useState("");
  const [xIdx, setXIdx] = useState(0);
  const [yIdx, setYIdx] = useState(1);
  const [scatterX, setScatterX] = useState(-1);
  const [chartType, setChartType] = useState("bar");
  const [zeroBase, setZeroBase] = useState(true);
  const [sort, setSort] = useState("original");
  const [topN, setTopN] = useState(0);
  const [percent, setPercent] = useState(false);
  const [themeId, setThemeId] = useState("cyan");
  const [customColor, setCustomColor] = useState("#22d3ee");
  const [dark, setDark] = useState(true);
  const [insight, setInsight] = useState({ loading: false, text: "", error: "" });
  const aiCount = useRef(0);
  const aiCache = useRef({});

  // Dark is the default look. Remember the choice if the visitor switches to light.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("dv-dark");
      if (saved === "1" || saved === "0") setDark(saved === "1");
    } catch (e) {
      // Storage can be blocked, so keep the default.
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    try {
      window.localStorage.setItem("dv-dark", next ? "1" : "0");
    } catch (e) {
      // Ignore storage problems.
    }
  }

  const accent =
    themeId === "custom"
      ? customColor
      : (COLOR_THEMES.find((t) => t.id === themeId) || COLOR_THEMES[0]).color;

  const numericIdx = useMemo(
    () => (table ? numericColumnIndexes(table.records, table.columns.length) : []),
    [table]
  );
  const labelIdx = table ? table.columns.findIndex((_, i) => !numericIdx.includes(i)) : -1;
  const canScatter = numericIdx.length >= 2;
  const isScatter = chartType === "scatter" && canScatter;
  const isPie = chartType === "pie" || chartType === "donut";

  const series = useMemo(
    () => (table ? buildSeries(table.records, xIdx, yIdx) : []),
    [table, xIdx, yIdx]
  );
  const total = useMemo(() => series.reduce((sum, p) => sum + p.value, 0), [series]);
  const canPercent = series.length > 0 && total > 0 && series.every((p) => p.value >= 0);

  const effScatterX =
    numericIdx.includes(scatterX) && scatterX !== yIdx
      ? scatterX
      : numericIdx.find((i) => i !== yIdx) ?? -1;

  const cardSeries = useMemo(() => {
    if (!table) return [];
    return isScatter
      ? buildSeries(table.records, labelIdx >= 0 ? labelIdx : 0, yIdx)
      : series;
  }, [table, isScatter, labelIdx, yIdx, series]);
  const stats = useMemo(() => summarize(cardSeries), [cardSeries]);

  const rows = useMemo(() => {
    if (chartType === "bar" || chartType === "line") {
      const shown = sortAndLimit(series, sort, topN);
      return chartType === "bar" ? shown.slice(0, MAX_BARS) : shown.slice(0, MAX_POINTS);
    }
    return [];
  }, [series, sort, topN, chartType]);

  const slices = useMemo(() => (isPie ? groupForPie(series, 8) : []), [series, isPie]);
  const points = useMemo(() => {
    if (!table || !isScatter || effScatterX < 0) return [];
    return buildScatter(table.records, effScatterX, yIdx, labelIdx).slice(0, MAX_POINTS);
  }, [table, isScatter, effScatterX, yIdx, labelIdx]);

  const palette = useMemo(
    () => makePalette(accent, Math.max(8, slices.length)),
    [accent, slices.length]
  );

  function loadText(text, name) {
    try {
      const parsed = parseTable(text);
      if (parsed.columns.length < 2 || parsed.records.length < 1) {
        throw new Error(
          "The file needs a header row, at least two columns, and at least one row of data."
        );
      }
      const numeric = numericColumnIndexes(parsed.records, parsed.columns.length);
      if (numeric.length === 0) {
        throw new Error(
          "No numeric column was found, so there is nothing to chart. Make sure at least one column contains numbers."
        );
      }
      const firstText = parsed.columns.findIndex((_, i) => !numeric.includes(i));
      const x = firstText >= 0 ? firstText : 0;
      const y = numeric.find((i) => i !== x) ?? numeric[0];
      setTable(parsed);
      setSourceName(name);
      setXIdx(x);
      setYIdx(y);
      setScatterX(-1);
      setSort("original");
      setTopN(0);
      setPercent(false);
      setChartType((prev) => (prev === "scatter" && numeric.length < 2 ? "bar" : prev));
      setInsight({ loading: false, text: "", error: "" });
      setError("");
    } catch (err) {
      setError(err.message || "That file could not be read.");
    }
  }

  async function handleFile(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is larger than 5 MB. Please upload a smaller CSV file.");
      input.value = "";
      return;
    }
    try {
      const text = await file.text();
      loadText(text, file.name);
    } catch (err) {
      setError("That file could not be read.");
    }
    input.value = "";
  }

  // Builds a short summary (never the whole file) to send to the AI.
  function buildSummary() {
    const base = {
      chartType,
      yName: table.columns[yIdx],
      rowCount: cardSeries.length,
    };
    if (isScatter) {
      const r = correlation(points);
      return {
        ...base,
        xName: table.columns[effScatterX],
        correlation: r === null ? null : Number(r.toFixed(3)),
        pointCount: points.length,
        stats: stats && {
          total: stats.total,
          average: stats.average,
          highest: stats.highest,
          lowest: stats.lowest,
        },
        rows: points.slice(0, 15).map((p) => ({ label: p.label, x: p.x, y: p.y })),
      };
    }
    const top = [...series].sort((a, b) => b.value - a.value).slice(0, 15);
    return {
      ...base,
      xName: table.columns[xIdx],
      stats: stats && {
        total: stats.total,
        average: stats.average,
        highest: stats.highest,
        lowest: stats.lowest,
      },
      rows: top.map((p) => ({ label: p.label, value: p.value })),
      filter: topN > 0 ? `Top ${topN}` : "All rows",
    };
  }

  async function explainChart() {
    if (!table || insight.loading) return;
    const summary = buildSummary();
    const key = JSON.stringify(summary);
    if (aiCache.current[key]) {
      setInsight({ loading: false, text: aiCache.current[key], error: "" });
      return;
    }
    if (aiCount.current >= MAX_AI_REQUESTS) {
      setInsight({
        loading: false,
        text: "",
        error: `You have used all ${MAX_AI_REQUESTS} AI explanations for this visit. Refresh the page to start again.`,
      });
      return;
    }
    aiCount.current += 1;
    setInsight({ loading: true, text: "", error: "" });
    try {
      const response = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.insight) {
        throw new Error(data.error || "The AI could not explain this chart right now.");
      }
      aiCache.current[key] = data.insight;
      setInsight({ loading: false, text: data.insight, error: "" });
    } catch (err) {
      setInsight({
        loading: false,
        text: "",
        error: err.message || "The AI could not explain this chart right now.",
      });
    }
  }

  const skipped = table ? table.records.length - series.length : 0;
  const showPercentToggle = !isPie && !isScatter;
  const percentOn = percent && canPercent && showPercentToggle;
  const chartKey = [
    chartType, xIdx, yIdx, effScatterX, sort, topN, percentOn, sourceName, accent,
  ].join("|");

  let title = "";
  if (table) {
    title = isScatter
      ? `${table.columns[yIdx]} vs ${table.columns[effScatterX]}`
      : `${table.columns[yIdx]} by ${table.columns[xIdx]}`;
  }

  return (
    <div
      className={styles.page}
      data-theme={dark ? "dark" : "light"}
      style={{ "--accent": accent }}
    >
      <Head>
        <title>Data Visualization App | {STUDENT_NAME}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@500;700&display=swap"
        />
      </Head>
      <style jsx global>{`
        body {
          margin: 0;
        }
      `}</style>

      <header className={styles.header}>
        <button
          type="button"
          className={styles.modeButton}
          onClick={toggleDark}
          aria-pressed={dark}
        >
          {dark ? "Light mode" : "Dark mode"}
        </button>
        <span className={styles.badge}>
          <span className={styles.pulse} /> AI powered
        </span>
        <h1 className={styles.title}>Data Visualization App</h1>
        <p className={styles.tagline}>Upload. Visualize. Understand.</p>
        <p className={styles.byline}>Built by {STUDENT_NAME} for CPS 5745</p>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>1. Add your data</h2>
          <p className={styles.hint}>
            Upload a CSV file with a header row. One column should contain numbers.
            Your file is read in your browser and is not uploaded anywhere.
          </p>
          <div className={styles.row}>
            <label className={styles.fileButton}>
              Choose a CSV file
              <input
                className={styles.fileInput}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFile}
              />
            </label>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => loadText(SAMPLE_CSV, SAMPLE_NAME)}
            >
              Use sample data
            </button>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>

        {table && stats && (
          <section className={styles.statsGrid} aria-label="Summary of the selected column">
            <StatCard label="Total" value={stats.total} sub={table.columns[yIdx]} />
            <StatCard label="Average" value={stats.average} sub={`${stats.count} rows`} delay={80} />
            <StatCard label="Highest" value={stats.highest.value} sub={stats.highest.label} delay={160} />
            <StatCard label="Lowest" value={stats.lowest.value} sub={stats.lowest.label} delay={240} />
          </section>
        )}

        {table && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>2. Choose what to show</h2>
            <p className={styles.hint}>
              Data source: <strong>{sourceName}</strong> ({table.records.length} rows)
            </p>

            <div className={styles.controls}>
              <label className={styles.control}>
                Chart type
                <select
                  className={styles.select}
                  value={isScatter || chartType !== "scatter" ? chartType : "bar"}
                  onChange={(e) => setChartType(e.target.value)}
                >
                  {CHART_TYPES.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.id === "scatter" && !canScatter}>
                      {t.name}
                      {t.id === "scatter" && !canScatter ? " (needs 2 number columns)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {isScatter ? (
                <label className={styles.control}>
                  X axis (numbers)
                  <select
                    className={styles.select}
                    value={effScatterX}
                    onChange={(e) => setScatterX(Number(e.target.value))}
                  >
                    {numericIdx
                      .filter((i) => i !== yIdx)
                      .map((i) => (
                        <option key={i} value={i}>
                          {table.columns[i]}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label className={styles.control}>
                  Categories
                  <select
                    className={styles.select}
                    value={xIdx}
                    onChange={(e) => setXIdx(Number(e.target.value))}
                  >
                    {table.columns.map((name, i) => (
                      <option key={i} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className={styles.control}>
                Values (y axis)
                <select
                  className={styles.select}
                  value={yIdx}
                  onChange={(e) => setYIdx(Number(e.target.value))}
                >
                  {numericIdx.map((i) => (
                    <option key={i} value={i}>
                      {table.columns[i]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.controls}>
              {(chartType === "bar" || chartType === "line") && (
                <>
                  <label className={styles.control}>
                    Sort
                    <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value)}>
                      <option value="original">Original order</option>
                      <option value="desc">High to low</option>
                      <option value="asc">Low to high</option>
                    </select>
                  </label>
                  <label className={styles.control}>
                    Show
                    <select
                      className={styles.select}
                      value={topN}
                      onChange={(e) => setTopN(Number(e.target.value))}
                    >
                      <option value={0}>All rows</option>
                      <option value={5}>Top 5</option>
                      <option value={10}>Top 10</option>
                      <option value={15}>Top 15</option>
                      <option value={20}>Top 20</option>
                    </select>
                  </label>
                </>
              )}
              {showPercentToggle && (
                <label className={styles.checkControl} title={canPercent ? "" : "Percentages need values that are all zero or positive."}>
                  <input
                    type="checkbox"
                    checked={percentOn}
                    disabled={!canPercent}
                    onChange={(e) => setPercent(e.target.checked)}
                  />
                  Show percentages
                </label>
              )}
              {chartType === "line" && !percentOn && (
                <label className={styles.checkControl}>
                  <input type="checkbox" checked={zeroBase} onChange={(e) => setZeroBase(e.target.checked)} />
                  Start the y axis at zero
                </label>
              )}
            </div>

            <div className={styles.colorRow}>
              <span className={styles.colorLabel}>Color</span>
              {COLOR_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.swatchButton} ${themeId === t.id ? styles.swatchActive : ""}`}
                  style={{ background: t.color }}
                  onClick={() => setThemeId(t.id)}
                  aria-label={`${t.name} color theme`}
                  aria-pressed={themeId === t.id}
                  title={t.name}
                />
              ))}
              <label className={`${styles.pickerLabel} ${themeId === "custom" ? styles.swatchActive : ""}`} title="Pick your own color">
                <input
                  className={styles.picker}
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setThemeId("custom");
                  }}
                  aria-label="Pick a custom color"
                />
              </label>
            </div>

            {(isPie ? slices.length === 0 : isScatter ? points.length === 0 : rows.length === 0) ? (
              <p className={styles.error}>
                {isPie
                  ? "Pie charts need positive numbers. Try a different column."
                  : "The selected columns have no numbers to draw. Try a different one."}
              </p>
            ) : (
              <>
                <h3 className={styles.chartTitle}>{title}</h3>
                <Chart
                  key={chartKey}
                  kind={isScatter ? "scatter" : chartType}
                  rows={rows}
                  pts={points}
                  slices={slices}
                  palette={palette}
                  color={accent}
                  xLabel={isScatter ? table.columns[effScatterX] : table.columns[xIdx]}
                  yLabel={table.columns[yIdx]}
                  percent={percentOn}
                  total={total}
                  canPercent={canPercent}
                  zeroBase={zeroBase}
                />
                <p className={styles.note}>
                  {isPie
                    ? `Showing the ${Math.min(slices.length, 8)} largest slices${series.length > 8 ? ", with the smallest grouped as Other" : ""}.`
                    : isScatter
                    ? `Showing ${points.length} points.`
                    : `Showing ${rows.length} of ${series.length} rows.${
                        chartType === "bar" && series.length > MAX_BARS && topN === 0
                          ? ` Bar charts show up to ${MAX_BARS} rows. Try "Top 10" or a line chart to see more.`
                          : ""
                      }`}
                  {skipped > 0 &&
                    ` ${skipped} row${skipped === 1 ? " was" : "s were"} skipped because the value was empty or not a number.`}
                  {" "}Hover or tap a {isPie ? "slice" : "bar or point"} to see its exact value.
                </p>

                <div className={styles.aiRow}>
                  <button
                    type="button"
                    className={styles.fileButton}
                    onClick={explainChart}
                    disabled={insight.loading}
                  >
                    {insight.loading ? "Thinking..." : "Explain this chart"}
                  </button>
                  <span className={styles.aiHint}>
                    Sends a short summary of the numbers (not your whole file) to an AI.
                  </span>
                </div>
                {insight.error && (
                  <p className={styles.error} role="alert">
                    {insight.error}
                  </p>
                )}
                {insight.text && (
                  <div className={styles.insight} aria-live="polite">
                    <div className={styles.insightTitle}>AI insight</div>
                    {insight.text.split(/\n+/).map((para, i) => (
                      <p key={i} className={styles.insightText}>
                        {para}
                      </p>
                    ))}
                    <p className={styles.insightNote}>
                      Written by an AI from the summary above. Check it against your data.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {table && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>3. Your data (first 8 rows)</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {table.columns.map((name, i) => (
                      <th key={i}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.records.slice(0, 8).map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        {STUDENT_NAME} | CPS 5745 Interactive Information Visualization
      </footer>
    </div>
  );
}