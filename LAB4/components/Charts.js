import { useEffect, useRef, useState } from "react";
import styles from "../pages/index.module.css";
import { formatNumber, formatPercent, niceTicks, shorten } from "../lib/chartUtils";

// Measures how wide the chart area is, so the chart can fit phones and desktops.
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(860);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(Math.floor(el.getBoundingClientRect().width) || 860);
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function AxisChart({ kind, rows, pts, xLabel, yLabel, color, percent, total, canPercent, zeroBase, width, showTip }) {
  const compact = width < 520;
  const height = compact ? 320 : 420;
  const left = compact ? 66 : 80;
  const right = compact ? 14 : 26;
  const top = 22;
  const innerW = Math.max(120, width - left - right);

  const isScatter = kind === "scatter";
  const n = isScatter ? pts.length : rows.length;
  const step = kind === "bar" ? innerW / n : n > 1 ? innerW / (n - 1) : innerW;
  const rotated = !isScatter && step < (kind === "bar" ? 64 : 90);
  const bottom = isScatter ? 58 : rotated ? (compact ? 86 : 96) : 62;
  const innerH = height - top - bottom;
  const bottomY = top + innerH;

  const val = (p) => (percent ? p.value / total : p.value);
  const yFmt = (v) => (percent && !isScatter ? formatPercent(v) : formatNumber(v, true));

  const yValues = isScatter ? pts.map((p) => p.y) : rows.map(val);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const forceZero = kind === "bar" || (kind === "line" && zeroBase);
  const yScale = niceTicks(forceZero ? Math.min(0, yMin) : yMin, forceZero ? Math.max(0, yMax) : yMax, 6);
  const yPos = (v) => top + innerH * (1 - (v - yScale.min) / (yScale.max - yScale.min));

  let xScale = null;
  if (isScatter) {
    const xs = pts.map((p) => p.x);
    xScale = niceTicks(Math.min(...xs), Math.max(...xs), compact ? 4 : 6);
  }
  const xPos = (i, p) => {
    if (isScatter) return left + innerW * ((p.x - xScale.min) / (xScale.max - xScale.min));
    if (kind === "bar") return left + step * (i + 0.5);
    return left + (n === 1 ? innerW / 2 : step * i);
  };

  const barWidth = Math.min(64, step * 0.7);
  const showValues = kind === "bar" && n <= (compact ? 8 : 15);
  const every = rotated ? Math.max(1, Math.ceil(18 / step)) : 1;
  const maxChars = rotated ? 14 : Math.max(5, Math.floor(step / 7));

  const tipText = (p) =>
    `${p.label}: ${formatNumber(p.value)}${canPercent ? ` (${formatPercent(p.value / total)})` : ""}`;

  const linePath = isScatter || kind === "bar"
    ? ""
    : rows.map((p, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)} ${yPos(val(p)).toFixed(1)}`).join(" ");

  const names = { bar: "Bar", line: "Line", scatter: "Scatter" };
  return (
    <svg
      className={styles.chart}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${names[kind]} chart of ${yLabel} by ${xLabel}`}
    >
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.45" />
        </linearGradient>
      </defs>

      {yScale.ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={left + innerW} y1={yPos(t)} y2={yPos(t)} className={t === 0 ? styles.zeroLine : styles.gridLine} />
          <text x={left - 8} y={yPos(t)} textAnchor="end" dominantBaseline="middle" className={styles.tickText}>
            {yFmt(t)}
          </text>
        </g>
      ))}

      {isScatter &&
        xScale.ticks.map((t) => (
          <g key={`x${t}`}>
            <line x1={left + innerW * ((t - xScale.min) / (xScale.max - xScale.min))} x2={left + innerW * ((t - xScale.min) / (xScale.max - xScale.min))} y1={top} y2={bottomY} className={styles.gridLine} />
            <text x={left + innerW * ((t - xScale.min) / (xScale.max - xScale.min))} y={bottomY + 18} textAnchor="middle" className={styles.tickText}>
              {formatNumber(t, true)}
            </text>
          </g>
        ))}

      {kind === "bar" &&
        rows.map((p, i) => {
          const v = val(p);
          const zeroY = yPos(0);
          const y = Math.min(yPos(v), zeroY);
          const h = Math.max(Math.abs(yPos(v) - zeroY), 1);
          const delay = `${Math.min(i * 35, 700)}ms`;
          return (
            <g key={i}>
              <rect
                data-tip="1"
                className={`${styles.bar} ${v < 0 ? styles.barNeg : ""}`}
                style={{ animationDelay: delay }}
                x={xPos(i) - barWidth / 2}
                y={y}
                width={barWidth}
                height={h}
                rx="3"
                fill="url(#barGrad)"
                stroke={color}
                strokeWidth="1"
                onPointerEnter={(e) => showTip(e, tipText(p))}
                onPointerMove={(e) => showTip(e, tipText(p))}
              />
              {showValues && (
                <text
                  className={`${styles.valueText} ${styles.fadeIn}`}
                  style={{ animationDelay: `${Math.min(i * 35, 700) + 350}ms` }}
                  x={xPos(i)}
                  y={v >= 0 ? y - 6 : y + h + 14}
                  textAnchor="middle"
                >
                  {percent ? formatPercent(v) : formatNumber(v, true)}
                </text>
              )}
            </g>
          );
        })}

      {kind === "line" && (
        <g>
          <path d={linePath} className={styles.linePath} pathLength="1" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
          {n <= 80 &&
            rows.map((p, i) => (
              <circle
                key={i}
                data-tip="1"
                className={`${styles.dot} ${styles.fadeIn}`}
                style={{ animationDelay: "700ms" }}
                cx={xPos(i)}
                cy={yPos(val(p))}
                r="4.5"
                fill={color}
                onPointerEnter={(e) => showTip(e, tipText(p))}
                onPointerMove={(e) => showTip(e, tipText(p))}
              />
            ))}
        </g>
      )}

      {isScatter &&
        pts.map((p, i) => (
          <circle
            key={i}
            data-tip="1"
            className={`${styles.dot} ${styles.pop}`}
            style={{ animationDelay: `${Math.min(i * 10, 500)}ms` }}
            cx={xPos(i, p)}
            cy={yPos(p.y)}
            r="5.5"
            fill={color}
            fillOpacity="0.75"
            stroke={color}
            onPointerEnter={(e) => showTip(e, `${p.label}: (${formatNumber(p.x)}, ${formatNumber(p.y)})`)}
            onPointerMove={(e) => showTip(e, `${p.label}: (${formatNumber(p.x)}, ${formatNumber(p.y)})`)}
          />
        ))}

      {!isScatter &&
        rows.map((p, i) => {
          if (i % every !== 0) return null;
          const x = xPos(i);
          const y = bottomY + 16;
          const text = shorten(p.label, maxChars);
          return rotated ? (
            <text key={i} x={x} y={y} textAnchor="end" transform={`rotate(-35 ${x} ${y})`} className={styles.tickText}>
              {text}
            </text>
          ) : (
            <text key={i} x={x} y={y} textAnchor="middle" className={styles.tickText}>
              {text}
            </text>
          );
        })}

      <text x={left + innerW / 2} y={height - 8} textAnchor="middle" className={styles.axisTitle}>
        {xLabel}
      </text>
      <text x={12} y={top + innerH / 2} textAnchor="middle" transform={`rotate(-90 12 ${top + innerH / 2})`} className={styles.axisTitle}>
        {yLabel}
      </text>
    </svg>
  );
}

function PieChart({ kind, slices, palette, width, showTip, yLabel, xLabel }) {
  const size = Math.min(width, 380);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 8;
  const r = kind === "donut" ? R * 0.58 : 0;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const point = (angle, radius) => [cx + radius * Math.sin(angle), cy - radius * Math.cos(angle)];

  let angle = 0;
  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    return { ...s, frac, a0, a1, color: palette[i % palette.length] };
  });

  const pathFor = (a0, a1) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = point(a0, R);
    const [x1, y1] = point(a1, R);
    if (r === 0) return `M${cx} ${cy} L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
    const [xi1, yi1] = point(a1, r);
    const [xi0, yi0] = point(a0, r);
    return `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${xi1} ${yi1} A${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`;
  };

  const tipText = (s) => `${s.label}: ${formatNumber(s.value)} (${formatPercent(s.frac)})`;

  return (
    <div className={styles.pieWrap}>
      <svg
        className={styles.pie}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${kind === "donut" ? "Donut" : "Pie"} chart of ${yLabel} by ${xLabel}`}
      >
        {arcs.length === 1 ? (
          <circle
            data-tip="1"
            className={`${styles.slice} ${styles.pop}`}
            cx={cx}
            cy={cy}
            r={r === 0 ? R : (R + r) / 2}
            fill={r === 0 ? arcs[0].color : "none"}
            stroke={r === 0 ? "none" : arcs[0].color}
            strokeWidth={r === 0 ? 0 : R - r}
            onPointerEnter={(e) => showTip(e, tipText(arcs[0]))}
            onPointerMove={(e) => showTip(e, tipText(arcs[0]))}
          />
        ) : (
          arcs.map((s, i) => (
            <path
              key={i}
              data-tip="1"
              className={`${styles.slice} ${styles.pop}`}
              style={{ animationDelay: `${i * 60}ms` }}
              d={pathFor(s.a0, s.a1)}
              fill={s.color}
              onPointerEnter={(e) => showTip(e, tipText(s))}
              onPointerMove={(e) => showTip(e, tipText(s))}
            />
          ))
        )}
        {arcs.map((s, i) => {
          if (s.frac < 0.06) return null;
          const mid = (s.a0 + s.a1) / 2;
          const [lx, ly] = point(mid, r === 0 ? R * 0.65 : (R + r) / 2);
          return (
            <text key={`l${i}`} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className={styles.sliceText}>
              {formatPercent(s.frac)}
            </text>
          );
        })}
        {kind === "donut" && (
          <g>
            <text x={cx} y={cy - 4} textAnchor="middle" className={styles.donutTotal}>
              {formatNumber(total, true)}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" className={styles.tickText}>
              Total
            </text>
          </g>
        )}
      </svg>
      <ul className={styles.legend}>
        {arcs.map((s, i) => (
          <li key={i} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{shorten(s.label, 28)}</span>
            <span className={styles.legendValue}>
              {formatNumber(s.value, true)} · {formatPercent(s.frac)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Chart(props) {
  const { kind } = props;
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);

  const showTip = (e, text) => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text });
  };
  const hideTip = () => setTip(null);

  const tipLeft = tip ? Math.min(Math.max(tip.x, 80), Math.max(80, width - 80)) : 0;

  return (
    <div
      ref={ref}
      className={styles.chartFrame}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") hideTip();
      }}
      onPointerDown={(e) => {
        if (!e.target.dataset || !e.target.dataset.tip) hideTip();
      }}
    >
      {kind === "pie" || kind === "donut" ? (
        <PieChart {...props} width={width} showTip={showTip} />
      ) : (
        <AxisChart {...props} width={width} showTip={showTip} />
      )}
      {tip && (
        <div className={styles.tooltip} style={{ left: tipLeft, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}