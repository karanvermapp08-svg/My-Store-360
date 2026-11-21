import React, { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { GraphSeries, GraphSeriesKey } from '../../utils/dashboardAnalytics';

interface DashboardChartsWidgetProps {
  graphs: Record<GraphSeriesKey, GraphSeries>;
  currencySymbol?: string;
  periodLabel: string;
}

const SERIES_ORDER: GraphSeriesKey[] = ['sales', 'purchase', 'profit', 'expense', 'income'];

export const DashboardChartsWidget: React.FC<DashboardChartsWidgetProps> = ({
  graphs,
  currencySymbol = '₹',
  periodLabel,
}) => {
  const [activeKey, setActiveKey] = useState<GraphSeriesKey>('sales');
  const [chartMode, setChartMode] = useState<'area' | 'bar'>('area');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeSeries = graphs[activeKey];
  const points = activeSeries.points;
  const maxVal = Math.max(1, ...points.map((p) => Math.max(0, p.value)));
  const minVal = Math.min(0, ...points.map((p) => p.value));
  const span = Math.max(1, maxVal - minVal);

  const fmt = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString('en-IN')}`;

  // SVG coordinate space
  const svgW = 720;
  const svgH = 210;
  const padL = 12;
  const padR = 12;
  const padT = 18;
  const padB = 14;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const coords = points.map((pt, idx) => {
    const x = points.length <= 1 ? padL + plotW / 2 : padL + (idx / (points.length - 1)) * plotW;
    const y = padT + ((maxVal - pt.value) / span) * plotH;
    return { x, y, pt };
  });

  const baselineY = padT + (maxVal / span) * plotH;

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`
      : '';

  const gridLevels = [1, 0.75, 0.5, 0.25, 0].map((ratio) => Math.round(minVal + span * ratio));

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      {/* Header & Unified Chart Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Financial Performance Graphs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeSeries.label} · {periodLabel} · Hover points for bucket breakdown
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Series Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {SERIES_ORDER.map((key) => {
              const s = graphs[key];
              const isSelected = activeKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveKey(key);
                    setHoveredIdx(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Chart Style Switch */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setChartMode('area')}
              title="Area Trend Line"
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'area' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Line</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              title="Bar Comparison"
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'bar' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Bars</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Series Summary Row */}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {fmt(activeSeries.total)}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
              activeSeries.deltaPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {activeSeries.deltaPercent >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>
              {activeSeries.deltaPercent >= 0 ? '+' : ''}
              {activeSeries.deltaPercent}% vs prior bucket
            </span>
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 tabular-nums">
          <span>
            Bucket Avg <strong className="text-slate-800">{fmt(activeSeries.average)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Peak <strong className="text-slate-800">{fmt(activeSeries.peak)}</strong>
          </span>
        </div>
      </div>

      {/* Main Unified Interactive SVG Chart */}
      <div className="relative">
        <div className="flex gap-3">
          {/* Y-Axis Labels */}
          <div className="flex flex-col justify-between text-[11px] font-mono text-slate-400 tabular-nums py-2 text-right w-14 shrink-0">
            {gridLevels.map((lvl, idx) => (
              <span key={idx}>
                {lvl >= 1000 ? `${currencySymbol}${(lvl / 1000).toFixed(lvl >= 10000 ? 0 : 1)}k` : `${currencySymbol}${lvl}`}
              </span>
            ))}
          </div>

          {/* SVG Plot */}
          <div className="flex-1 relative">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-52 overflow-visible"
              preserveAspectRatio="none"
            >
              {/* Horizontal Gridlines */}
              {gridLevels.map((_, i) => {
                const y = padT + (i / (gridLevels.length - 1)) * plotH;
                return (
                  <line
                    key={i}
                    x1={padL}
                    y1={y}
                    x2={svgW - padR}
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                  />
                );
              })}

              {chartMode === 'area' ? (
                <>
                  {areaPath && (
                    <path d={areaPath} fill={activeSeries.fillColor} />
                  )}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke={activeSeries.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {coords.map((c, idx) => {
                    const isHovered = hoveredIdx === idx;
                    return (
                      <g key={idx}>
                        {isHovered && (
                          <line
                            x1={c.x}
                            y1={padT}
                            x2={c.x}
                            y2={svgH - padB}
                            stroke="#cbd5e1"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                        )}
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r={isHovered ? 5.5 : 3.5}
                          fill="#ffffff"
                          stroke={activeSeries.color}
                          strokeWidth={isHovered ? 2.5 : 2}
                        />
                        <rect
                          x={c.x - plotW / Math.max(2, points.length * 2)}
                          y={0}
                          width={plotW / Math.max(1, points.length)}
                          height={svgH}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        />
                      </g>
                    );
                  })}
                </>
              ) : (
                coords.map((c, idx) => {
                  const slotW = plotW / Math.max(1, points.length);
                  const barW = Math.min(44, Math.max(14, slotW * 0.54));
                  const xCenter =
                    points.length <= 1
                      ? padL + plotW / 2
                      : padL + (idx + 0.5) * slotW;
                  const barTop = Math.min(c.y, baselineY);
                  const barH = Math.max(2, Math.abs(baselineY - c.y));
                  const isHovered = hoveredIdx === idx;
                  return (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      <rect
                        x={xCenter - barW / 2}
                        y={barTop}
                        width={barW}
                        height={barH}
                        rx="4"
                        fill={activeSeries.color}
                        opacity={isHovered ? 1 : 0.85}
                      />
                    </g>
                  );
                })
              )}
            </svg>

            {/* Hover Tooltip */}
            {hoveredIdx !== null && points[hoveredIdx] && (
              <div
                className="absolute top-1 right-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-md pointer-events-none tabular-nums z-10"
              >
                <div className="font-semibold text-slate-200">{points[hoveredIdx].label}</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {fmt(points[hoveredIdx].value)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {points[hoveredIdx].count} entries
                </div>
              </div>
            )}

            {/* X-Axis Labels */}
            <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-2 px-1">
              {points.map((p, idx) => (
                <span
                  key={idx}
                  className={hoveredIdx === idx ? 'text-slate-900 font-semibold' : ''}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5 Individual Mini-Graphs Strip (Sales, Purchase, Profit, Expense, Income) */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-700">
            All 5 Trend Sparklines (click any mini-graph to focus)
          </h3>
          <span className="text-[11px] text-slate-400">Sales · Purchase · Profit · Expense · Income</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SERIES_ORDER.map((key) => {
            const s = graphs[key];
            const isActive = activeKey === key;
            const sMax = Math.max(1, ...s.points.map((p) => p.value));
            const sMin = Math.min(0, ...s.points.map((p) => p.value));
            const sSpan = Math.max(1, sMax - sMin);
            const miniCoords = s.points.map((pt, i) => {
              const mx = s.points.length <= 1 ? 60 : (i / (s.points.length - 1)) * 120;
              const my = 4 + ((sMax - pt.value) / sSpan) * 28;
              return `${mx.toFixed(1)},${my.toFixed(1)}`;
            });

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveKey(key);
                  setHoveredIdx(null);
                }}
                className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? 'border-slate-900 bg-slate-50/80'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600 truncate">
                    {s.label.replace(' Trend', ' Graph')}
                  </span>
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      s.deltaPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {s.deltaPercent >= 0 ? '+' : ''}
                    {s.deltaPercent}%
                  </span>
                </div>

                <div className="text-sm font-bold text-slate-900 mt-1 tabular-nums">
                  {fmt(s.total)}
                </div>

                <svg viewBox="0 0 120 36" className="w-full h-9 mt-2 overflow-visible">
                  <polyline
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={miniCoords.join(' ')}
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
