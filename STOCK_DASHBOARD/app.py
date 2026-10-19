"""
Big Tech Stock Comparison Dashboard
Apple (AAPL), Alphabet / Google (GOOGL), Amazon (AMZN)
Design reference: Kean University Office of Institutional Research enrollment dashboard

Author: David Arosemena
Developed for CPS*5745
"""

from datetime import date, timedelta

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf

# ------------------------------------------------------------------
# Settings
# ------------------------------------------------------------------
st.set_page_config(
    page_title="Big Tech Stocks | CPS*5745",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed",
)

AUTHOR = "David Arosemena"
COURSE = "Developed for CPS*5745"

COMPANIES = {"AAPL": "Apple", "GOOGL": "Google", "AMZN": "Amazon"}
COLORS = {"Apple": "#24426B", "Google": "#00897B", "Amazon": "#E8A900"}

NAVY = "#1F2F54"
LABEL_BLUE = "#1A4FA3"
GRID = "#E6E9EF"
FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif"

TODAY = date.today()
RANGES = {
    "1 Month": TODAY - timedelta(days=30),
    "3 Months": TODAY - timedelta(days=91),
    "6 Months": TODAY - timedelta(days=182),
    "Year to Date": date(TODAY.year, 1, 1),
    "1 Year": TODAY - timedelta(days=365),
    "3 Years": TODAY - timedelta(days=3 * 365),
    "5 Years": TODAY - timedelta(days=5 * 365),
    "Custom": None,
}
DEFAULTS = {
    "f_companies": list(COMPANIES.keys()),
    "f_range": "1 Year",
    "f_scale": "Linear",
    "f_window": 30,
}
for k, v in DEFAULTS.items():
    st.session_state.setdefault(k, v)


def reset_filters():
    for k, v in DEFAULTS.items():
        st.session_state[k] = v
    st.session_state.pop("f_custom", None)


# Streamlit renamed the "fill the column" option in newer versions
_ST_VER = tuple(int(p) for p in st.__version__.split(".")[:2] if p.isdigit())


FULL = {"width": "stretch"} if _ST_VER >= (1, 46) else {"use_container_width": True}


def show(fig):
    if _ST_VER >= (1, 46):
        st.plotly_chart(fig, width="stretch", config={"displaylogo": False})
    else:
        st.plotly_chart(fig, use_container_width=True, config={"displaylogo": False})


# ------------------------------------------------------------------
# Styling (Kean look: navy banner, serif titles, blue filter labels)
# ------------------------------------------------------------------
st.markdown(
    f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap');
    .block-container {{ padding-top: 1.2rem; padding-bottom: 1rem; max-width: 1500px; }}
    header[data-testid="stHeader"] {{ background: transparent; }}
    .kean-banner {{
        background: {NAVY}; color: #fff; border-bottom: 3px solid #3B5998;
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 28px; border-radius: 4px; flex-wrap: wrap; gap: 8px;
    }}
    .kean-banner .brand {{ font-family: 'Libre Baskerville', Georgia, serif; font-size: 2.3rem; letter-spacing: 1px; }}
    .kean-banner .office {{ font-family: 'Libre Baskerville', Georgia, serif; font-size: 1.55rem; text-align: right; }}
    .kean-banner .office small {{ display: block; font-family: {FONT}; font-size: .85rem; color: #C9D3E8; }}
    .page-title {{ font-family: 'Libre Baskerville', Georgia, serif; font-size: 1.7rem; font-weight: 700;
                   color: #111; margin: 14px 0 2px 0; }}
    .byline {{ color: #444; font-size: .95rem; margin-bottom: 8px; }}
    .byline b {{ color: {NAVY}; }}
    .flabel {{ color: {LABEL_BLUE}; font-weight: 700; font-size: .85rem; margin-bottom: 4px; line-height: 1.3; }}
    .section {{ font-size: 1.3rem; font-weight: 600; color: #111; margin: 6px 0 0 0; }}
    .section span {{ font-size: .85rem; font-weight: 400; color: #666; }}
    .graybar {{ background: #D9D9D9; text-align: center; font-weight: 700; font-size: 1.2rem;
                padding: 8px; margin: 14px 0 6px 0; color: #111; }}
    .kpi {{ display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; }}
    .kpi .k {{ font-size: 1.05rem; color: #222; }}
    .kpi .v {{ font-size: 1.6rem; color: {NAVY}; font-weight: 500; }}
    .kpi.first {{ background: #EDEDED; padding: 10px 12px; }}
    .kpi.first .k {{ font-weight: 700; }}
    .chip {{ display: inline-block; width: 11px; height: 11px; border-radius: 50%; margin-right: 6px; }}
    .filters-now {{ background: #F3F6FB; border-left: 5px solid {NAVY}; padding: 8px 14px;
                    font-size: .9rem; color: #222; margin: 6px 0 4px 0; }}
    button[kind="primary"] {{ background: {NAVY} !important; border-color: {NAVY} !important; }}
    button[kind="primary"] * {{ color: #fff !important; }}
    button[kind="secondary"] {{ background: #3E7BD6 !important; border-color: #3E7BD6 !important; }}
    button[kind="secondary"] * {{ color: #fff !important; }}
    button[kind="primary"] p, button[kind="secondary"] p {{ font-family: 'Libre Baskerville', Georgia, serif; }}
    .footer {{ text-align: center; color: #666; font-size: .85rem; margin-top: 12px; }}
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    f"""
    <div class="kean-banner">
      <div class="brand">KEAN</div>
      <div class="office">Big Tech Stock Comparison
        <small>Interactive Information Visualization &nbsp;|&nbsp; {COURSE}</small></div>
    </div>
    <div class="page-title">Stock Performance: Apple, Google &amp; Amazon</div>
    <div class="byline">Dashboard by <b>{AUTHOR}</b> &nbsp;|&nbsp; <b>{COURSE}</b></div>
    """,
    unsafe_allow_html=True,
)

# ------------------------------------------------------------------
# Shared filter row
# ------------------------------------------------------------------
f1, f2, f3, f4, f5, f6 = st.columns([3, 1.6, 2.2, 1.4, 1.8, 0.7], vertical_alignment="bottom") \
    if _ST_VER >= (1, 36) else st.columns([3, 1.6, 2.2, 1.4, 1.8, 0.7])

with f1:
    st.markdown('<div class="flabel">🏢 Companies</div>', unsafe_allow_html=True)
    selected = st.multiselect(
        "Companies", list(COMPANIES.keys()), key="f_companies",
        format_func=lambda t: COMPANIES[t], label_visibility="collapsed",
    )
with f2:
    st.markdown('<div class="flabel">📅 Date Range</div>', unsafe_allow_html=True)
    range_choice = st.selectbox("Date range", list(RANGES.keys()), key="f_range",
                                label_visibility="collapsed")
with f3:
    st.markdown('<div class="flabel">🗓️ Custom Dates</div>', unsafe_allow_html=True)
    if range_choice == "Custom":
        custom = st.date_input("Custom dates", value=(TODAY - timedelta(days=365), TODAY),
                               min_value=date(2010, 1, 1), max_value=TODAY,
                               key="f_custom", label_visibility="collapsed")
    else:
        st.text_input("Custom dates", value=f"{RANGES[range_choice]:%m/%d/%Y} to {TODAY:%m/%d/%Y}",
                      disabled=True, label_visibility="collapsed")
        custom = None
with f4:
    st.markdown('<div class="flabel">📐 Price Scale</div>', unsafe_allow_html=True)
    scale = st.selectbox("Price scale", ["Linear", "Log"], key="f_scale", label_visibility="collapsed")
with f5:
    st.markdown('<div class="flabel">📊 Volatility Window</div>', unsafe_allow_html=True)
    window = st.selectbox("Window", [10, 20, 30, 60, 90], key="f_window",
                              format_func=lambda d: f"{d} days", label_visibility="collapsed")
with f6:
    st.button("↺", on_click=reset_filters, help="Reset all filters", **FULL)

if range_choice == "Custom":
    if isinstance(custom, (list, tuple)) and len(custom) == 2:
        start_date, end_date = custom
    else:
        st.info("Pick both a start date and an end date.")
        st.stop()
else:
    start_date, end_date = RANGES[range_choice], TODAY

if not selected:
    st.warning("Select at least one company.")
    st.stop()
if start_date >= end_date:
    st.warning("The start date must be before the end date.")
    st.stop()


# ------------------------------------------------------------------
# Data
# ------------------------------------------------------------------
@st.cache_data(ttl=3600, show_spinner="Downloading the latest stock data from Yahoo Finance...")
def load_prices(tickers: tuple, start: date, end: date) -> pd.DataFrame:
    frames = []
    for t in tickers:
        hist = yf.Ticker(t).history(start=start, end=end + timedelta(days=1), auto_adjust=True)
        if hist.empty:
            continue
        hist = hist.reset_index()[["Date", "Close", "Volume"]]
        hist["Date"] = pd.to_datetime(hist["Date"]).dt.tz_localize(None).dt.normalize()
        hist["Ticker"] = t
        hist["Company"] = COMPANIES[t]
        frames.append(hist)
    if not frames:
        return pd.DataFrame(columns=["Date", "Close", "Volume", "Ticker", "Company"])
    return pd.concat(frames, ignore_index=True)


try:
    df = load_prices(tuple(selected), start_date, end_date)
except Exception as e:  # network or rate limit problems
    st.error(f"Could not download stock data right now ({e}). Please refresh in a minute.")
    st.stop()

if df.empty or df.groupby("Company").size().min() < 3:
    st.error("Not enough trading days in this selection. Try a wider date range.")
    st.stop()

names = [COMPANIES[t] for t in selected if COMPANIES[t] in set(df["Company"])]
cmap = {n: COLORS[n] for n in names}
order = {"Company": names}

df = df.sort_values(["Company", "Date"]).reset_index(drop=True)
g = df.groupby("Company")
df["Return %"] = g["Close"].pct_change() * 100
df["Growth %"] = (df["Close"] / g["Close"].transform("first") - 1) * 100
df["Drawdown %"] = (df["Close"] / df.groupby("Company")["Close"].cummax() - 1) * 100
df["Dollar Vol"] = df["Close"] * df["Volume"]
df["Rolling Vol %"] = df.groupby("Company")["Return %"].transform(lambda s: s.rolling(window).std()) * np.sqrt(252)

stats = (
    df.groupby("Company")
    .agg(
        start=("Close", "first"), latest=("Close", "last"), total=("Growth %", "last"),
        vol=("Return %", lambda s: s.std() * np.sqrt(252)), mdd=("Drawdown %", "min"),
        best=("Return %", "max"), worst=("Return %", "min"), dollar=("Dollar Vol", "mean"),
    )
    .reindex(names)
)
last_day = df["Date"].max()
n_days = df["Date"].nunique()

st.markdown(
    f'<div class="filters-now"><b>Selected filters:</b> {", ".join(names)} &nbsp;|&nbsp; '
    f'{range_choice} ({start_date:%b %d, %Y} to {end_date:%b %d, %Y}) &nbsp;|&nbsp; '
    f'{scale} price scale &nbsp;|&nbsp; {window} day volatility window &nbsp;|&nbsp; '
    f'Latest trading day: {last_day:%b %d, %Y}</div>',
    unsafe_allow_html=True,
)


def base_layout(fig, height=300, y_title=None, x_title=None, legend=True):
    fig.update_layout(
        template="plotly_white", height=height, font=dict(family=FONT, size=13, color="#222"),
        margin=dict(l=10, r=20, t=30, b=10), showlegend=legend,
        legend=dict(orientation="h", y=1.12, x=0, title_text=""),
        plot_bgcolor="white", paper_bgcolor="white",
    )
    fig.update_xaxes(title=x_title, gridcolor=GRID, zeroline=False)
    fig.update_yaxes(title=y_title, gridcolor=GRID, zeroline=False)
    return fig


def hbar(series, fmt, x_title, height=190):
    d = series.rename("v").reset_index()
    fig = px.bar(d, x="v", y="Company", orientation="h", color="Company",
                 color_discrete_map=cmap, category_orders=order, text=d["v"].map(fmt.format))
    fig.update_traces(textposition="outside", cliponaxis=False, hovertemplate="%{y}: %{text}<extra></extra>")
    base_layout(fig, height=height, x_title=x_title, legend=False)
    fig.update_yaxes(title=None)
    lo, hi = min(0, d["v"].min()), max(0, d["v"].max())
    pad = (hi - lo) * 0.28 or 1
    fig.update_xaxes(zeroline=True, zerolinecolor="#999",
                     range=[lo - (pad if lo < 0 else 0), hi + (pad if hi > 0 else 0)])
    fig.update_traces(textposition="outside")
    return fig


def section(title, note=""):
    st.markdown(f'<div class="section">{title} <span>{note}</span></div>', unsafe_allow_html=True)


# ------------------------------------------------------------------
# Pages
# ------------------------------------------------------------------
# Page buttons (like Kean's "At-a-Glance" / "College & Department" buttons)
st.session_state.setdefault("page", "glance")


def set_page(p):
    st.session_state["page"] = p


corr = None
if len(names) >= 2:
    corr = df.pivot_table(index="Date", columns="Company", values="Return %").reindex(columns=names).corr()

pb1, pb2, _sp = st.columns([1.4, 1.8, 6])
pb1.button("➜  At-a-Glance", on_click=set_page, args=("glance",), width="stretch",
           type="primary" if st.session_state["page"] == "glance" else "secondary")
pb2.button("➜  Price & Risk Detail", on_click=set_page, args=("detail",), width="stretch",
           type="primary" if st.session_state["page"] == "detail" else "secondary")

# ============================ PAGE 1 =============================
if st.session_state["page"] == "glance":
    left, mid, right = st.columns([1.15, 2.3, 1.25], gap="large")

    with left:
        section("Total Return", "(%)")
        show(hbar(stats["total"], "{:+.1f}%", "Return (%)"))
        section("Annualized Volatility", "(%)")
        show(hbar(stats["vol"], "{:.1f}%", "Volatility (%)"))
        section("Maximum Drawdown", "(%)")
        show(hbar(stats["mdd"], "{:.1f}%", "Drawdown (%)"))

    with mid:
        section("Cumulative Return Since Start of Range", "(%, every stock starts at 0)")
        fig = px.line(df, x="Date", y="Growth %", color="Company",
                      color_discrete_map=cmap, category_orders=order)
        fig.update_traces(line=dict(width=2.6), hovertemplate="%{y:+.1f}%")
        fig.add_hline(y=0, line_dash="dot", line_color="#888")
        base_layout(fig, height=380, y_title="Return since start (%)")
        fig.update_layout(hovermode="x unified")
        show(fig)

        section("Comparison Table")
        table = pd.DataFrame({
            "Company": names,
            "Start Price ($)": stats["start"].values,
            "Latest Price ($)": stats["latest"].values,
            "Total Return (%)": stats["total"].values,
            "Best Day (%)": stats["best"].values,
            "Worst Day (%)": stats["worst"].values,
            "Avg Daily $ Volume ($B)": (stats["dollar"] / 1e9).values,
        })
        st.dataframe(
            table, hide_index=True, **FULL,
            column_config={
                "Start Price ($)": st.column_config.NumberColumn(format="$%.2f"),
                "Latest Price ($)": st.column_config.NumberColumn(format="$%.2f"),
                "Total Return (%)": st.column_config.NumberColumn(format="%+.1f%%"),
                "Best Day (%)": st.column_config.NumberColumn(format="%+.2f%%"),
                "Worst Day (%)": st.column_config.NumberColumn(format="%+.2f%%"),
                "Avg Daily $ Volume ($B)": st.column_config.NumberColumn(format="$%.2fB"),
            },
        )

    with right:
        best_name = stats["total"].idxmax()
        calm_name = stats["vol"].idxmin()
        kpis = [
            ("Trading Days:", f"{n_days}"),
            ("Top Performer:", f"{best_name}"),
            ("Steadiest:", f"{calm_name}"),
        ]
        html = ""
        for i, (k, v) in enumerate(kpis):
            html += f'<div class="kpi {"first" if i == 0 else ""}"><span class="k">{k}</span><span class="v">{v}</span></div>'
        for n in names:
            html += (f'<div class="kpi"><span class="k"><span class="chip" style="background:{COLORS[n]}"></span>'
                     f'{n} close:</span><span class="v">${stats.loc[n, "latest"]:,.2f}</span></div>')
        st.markdown(html, unsafe_allow_html=True)
        st.caption("Summary indicators")

        section("Share of Dollar Volume Traded", "(price × shares)")
        share = df.groupby("Company")["Dollar Vol"].sum().reindex(names).reset_index()
        fig = go.Figure(go.Pie(
            labels=share["Company"], values=share["Dollar Vol"], hole=0.55, sort=False,
            marker=dict(colors=[COLORS[n] for n in share["Company"]], line=dict(color="white", width=2)),
            textinfo="label+percent", textposition="outside",
            hovertemplate="%{label}: $%{value:,.0f} (%{percent})<extra></extra>",
        ))
        base_layout(fig, height=320, legend=False)
        fig.update_layout(margin=dict(l=30, r=30, t=30, b=30))
        show(fig)

# ============================ PAGE 2 =============================
else:
    st.markdown('<div class="graybar">Price and Trading Activity</div>', unsafe_allow_html=True)
    a, b = st.columns(2, gap="large")
    with a:
        section("Daily Closing Price", f"(USD, {scale.lower()} scale, adjusted for splits and dividends)")
        fig = px.line(df, x="Date", y="Close", color="Company", color_discrete_map=cmap,
                      category_orders=order, log_y=(scale == "Log"))
        fig.update_traces(line=dict(width=2.2), hovertemplate="$%{y:,.2f}")
        base_layout(fig, height=360, y_title="Closing price (USD)")
        fig.update_yaxes(tickprefix="$")
        fig.update_layout(hovermode="x unified")
        show(fig)
    with b:
        section("Average Daily Dollar Volume by Month", "(billions of USD)")
        monthly = (df.assign(Month=df["Date"].dt.to_period("M").dt.to_timestamp())
                   .groupby(["Month", "Company"], as_index=False)["Dollar Vol"].mean())
        monthly["$B"] = monthly["Dollar Vol"] / 1e9
        fig = px.bar(monthly, x="Month", y="$B", color="Company", barmode="group",
                     color_discrete_map=cmap, category_orders=order)
        fig.update_traces(hovertemplate="$%{y:.2f}B")
        base_layout(fig, height=360, y_title="Avg daily dollar volume ($B)")
        fig.update_yaxes(tickprefix="$", ticksuffix="B")
        fig.update_layout(hovermode="x unified")
        show(fig)

    st.markdown('<div class="graybar">Risk and Relationships</div>', unsafe_allow_html=True)
    c, d, e = st.columns([1, 1.4, 1], gap="large")
    with c:
        section("Daily Return Distribution", "(%)")
        fig = px.box(df.dropna(subset=["Return %"]), x="Company", y="Return %", color="Company",
                     color_discrete_map=cmap, category_orders=order, points="outliers")
        fig.add_hline(y=0, line_dash="dot", line_color="#888")
        base_layout(fig, height=360, y_title="Daily return (%)", legend=False)
        fig.update_xaxes(title=None)
        show(fig)
    with d:
        section(f"{window} Day Rolling Volatility", "(annualized %)")
        fig = px.line(df.dropna(subset=["Rolling Vol %"]), x="Date", y="Rolling Vol %", color="Company",
                      color_discrete_map=cmap, category_orders=order)
        fig.update_traces(line=dict(width=2.2), hovertemplate="%{y:.1f}%")
        base_layout(fig, height=360, y_title="Volatility (%)")
        fig.update_yaxes(rangemode="tozero", ticksuffix="%")
        fig.update_layout(hovermode="x unified")
        show(fig)
    with e:
        section("Correlation of Daily Returns", "(1 = move together)")
        corr = None
        if len(names) >= 2:
            wide = df.pivot_table(index="Date", columns="Company", values="Return %").reindex(columns=names)
            corr = wide.corr()
            fig = go.Figure(go.Heatmap(
                z=corr.values, x=corr.columns, y=corr.index, zmin=0, zmax=1,
                colorscale=[[0, "#F2F5FA"], [1, NAVY]],
                text=np.round(corr.values, 2), texttemplate="%{text}",
                textfont=dict(size=15), hovertemplate="%{y} vs %{x}: %{z:.2f}<extra></extra>",
                colorbar=dict(title="r", thickness=12),
            ))
            base_layout(fig, height=360, legend=False)
            fig.update_yaxes(autorange="reversed", gridcolor="white")
            fig.update_xaxes(gridcolor="white")
            show(fig)
        else:
            st.info("Select at least two companies to see correlations.")

# ------------------------------------------------------------------
# Key differences (computed from the current filters)
# ------------------------------------------------------------------
st.markdown('<div class="graybar">Key Differences Revealed</div>', unsafe_allow_html=True)

worst_name = stats["total"].idxmin()
risky_name = stats["vol"].idxmax()
deep_name = stats["mdd"].idxmin()
busy_name = stats["dollar"].idxmax()

points = [
    f"**Growth:** {best_name} returned the most over this range ({stats.loc[best_name, 'total']:+.1f}%)"
    + (f", while {worst_name} returned the least ({stats.loc[worst_name, 'total']:+.1f}%)." if best_name != worst_name else "."),
    f"**Risk:** {risky_name} had the biggest day to day swings ({stats.loc[risky_name, 'vol']:.1f}% annualized volatility)"
    + (f"; {calm_name} was the steadiest ({stats.loc[calm_name, 'vol']:.1f}%)." if risky_name != calm_name else "."),
    f"**Worst decline:** {deep_name} fell the furthest from a previous high ({stats.loc[deep_name, 'mdd']:.1f}%).",
    f"**Trading activity:** {busy_name} had the most money changing hands, about "
    f"${stats.loc[busy_name, 'dollar'] / 1e9:,.1f}B per day on average.",
]
if corr is not None:
    pairs = corr.where(np.triu(np.ones(corr.shape, dtype=bool), k=1)).stack()
    (p1, p2), r = pairs.idxmax(), pairs.max()
    points.append(f"**Moving together:** {p1} and {p2} are the most closely linked (correlation {r:.2f}), "
                  "since all three are large tech stocks that react to the same market news.")
points.append("**Reading the charts:** share prices are very different in dollars, so the cumulative return "
              "chart (all starting at 0%) is the fair way to compare growth, and dollar volume is used "
              "instead of share counts so trading activity is compared in the same unit.")
for p in points:
    st.markdown(f"- {p}")

st.markdown(
    f'<div class="footer"><b>{AUTHOR}</b> &nbsp;|&nbsp; <b>{COURSE}</b> &nbsp;|&nbsp; '
    f'Data: Yahoo Finance via yfinance, refreshed hourly</div>',
    unsafe_allow_html=True,
)
