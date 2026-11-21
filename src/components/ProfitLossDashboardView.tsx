import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Package,
  ShieldCheck,
  Lock,
  Unlock,
  Download,
  Printer,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  FileSpreadsheet,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useVyapar } from '../context/VyaparContext';
import {
  computeComprehensivePL,
  PLPeriodFilter,
  PriceRecommendationRow,
} from '../utils/profitEngine';

type DashboardTab =
  | 'overview'
  | 'statement'
  | 'breakdowns'
  | 'reconciliation'
  | 'ai-bi';

type BreakdownSubTab =
  | 'products'
  | 'categories'
  | 'customers'
  | 'customer-product-brand'
  | 'discounts';
type ProductSortMode = 'profit' | 'loss' | 'revenue' | 'score';
type ForecastChartSeriesMode = 'both' | 'gp' | 'revenue';

const fmt = (val: number) =>
  `₹${Math.round(Number(val) || 0).toLocaleString('en-IN')}`;

const fmtExact = (val: number) =>
  `₹${(Number(val) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const ProfitLossDashboardView: React.FC = () => {
  const {
    transactions,
    items,
    parties,
    batches,
    journalVouchers,
    businessSettings,
    discountApprovals,
    company,
    setActiveTab,
    canOverrideStockLimit,
    lockFinancialPeriod,
    unlockFinancialPeriod,
    applyRecommendedItemPrice,
    showToast,
  } = useVyapar();

  const [period, setPeriod] = useState<PLPeriodFilter>('All Time');
  const [fyStartYear, setFyStartYear] = useState<number>(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [activeViewTab, setActiveViewTab] = useState<DashboardTab>('overview');
  const [breakdownSubTab, setBreakdownSubTab] =
    useState<BreakdownSubTab>('products');
  const [productSort, setProductSort] = useState<ProductSortMode>('profit');
  const [productSearch, setProductSearch] = useState('');
  const [cpbSearch, setCpbSearch] = useState('');
  const [cpbCustomerFilter, setCpbCustomerFilter] = useState('All');
  const [cpbBrandFilter, setCpbBrandFilter] = useState('All');
  const [forecastSeriesMode, setForecastSeriesMode] =
    useState<ForecastChartSeriesMode>('both');
  const [hoveredForecastIdx, setHoveredForecastIdx] = useState<number | null>(
    null
  );

  // Financial Period Lock form state
  const [lockLabel, setLockLabel] = useState('Q1 FY Close');
  const [lockStart, setLockStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [lockEnd, setLockEnd] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [lockingBusy, setLockingBusy] = useState(false);

  // Admin confirmation modal for Smart Selling Price Recommender
  const [priceConfirmRow, setPriceConfirmRow] =
    useState<PriceRecommendationRow | null>(null);
  const [customRecommendedPrice, setCustomRecommendedPrice] =
    useState<string>('');

  const isAdminUser = canOverrideStockLimit();

  const report = useMemo(
    () =>
      computeComprehensivePL({
        transactions,
        items,
        parties,
        batches,
        journalVouchers,
        discountApprovals,
        settings: businessSettings,
        period,
        customStartDate,
        customEndDate,
        fyStartYear,
      }),
    [
      transactions,
      items,
      parties,
      batches,
      journalVouchers,
      discountApprovals,
      businessSettings,
      period,
      customStartDate,
      customEndDate,
      fyStartYear,
    ]
  );

  const pl = report.tradingAndPL;
  const lockedPeriods = businessSettings?.accounting?.lockedPeriods || [];

  const sortedProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = report.productRows.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
    if (productSort === 'loss') {
      return [...list].sort((a, b) => a.grossProfit - b.grossProfit);
    }
    if (productSort === 'revenue') {
      return [...list].sort((a, b) => b.netSalesExGst - a.netSalesExGst);
    }
    if (productSort === 'score') {
      return [...list].sort((a, b) => b.performanceScore - a.performanceScore);
    }
    return [...list].sort((a, b) => b.grossProfit - a.grossProfit);
  }, [report.productRows, productSort, productSearch]);

  const maxTrendVal = Math.max(
    1,
    ...report.trendSeries.map((d) =>
      Math.max(d.sales, Math.abs(d.grossProfit), d.expenses)
    )
  );

  const cpbCustomers = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(report.customerProductBrandRows.map((r) => r.partyName))
      ).sort(),
    ],
    [report.customerProductBrandRows]
  );

  const cpbBrands = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(report.customerProductBrandRows.map((r) => r.brand))
      ).sort(),
    ],
    [report.customerProductBrandRows]
  );

  const filteredCustomerProductBrandRows = useMemo(() => {
    const q = cpbSearch.trim().toLowerCase();
    return report.customerProductBrandRows.filter((row) => {
      if (cpbCustomerFilter !== 'All' && row.partyName !== cpbCustomerFilter)
        return false;
      if (cpbBrandFilter !== 'All' && row.brand !== cpbBrandFilter) return false;
      if (
        q &&
        !row.partyName.toLowerCase().includes(q) &&
        !row.productName.toLowerCase().includes(q) &&
        !row.brand.toLowerCase().includes(q) &&
        !row.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [
    report.customerProductBrandRows,
    cpbSearch,
    cpbCustomerFilter,
    cpbBrandFilter,
  ]);

  const combinedForecastPoints = useMemo(() => {
    const hist = report.salesForecast.dailyHistorySeries.map((h) => ({
      kind: 'history' as const,
      dateIso: h.dateIso,
      label: h.label,
      revenue: h.revenue,
      revenueLower: h.revenue,
      revenueUpper: h.revenue,
      grossProfit: h.grossProfit,
      grossProfitLower: h.grossProfit,
      grossProfitUpper: h.grossProfit,
    }));
    const proj = report.salesForecast.projected30DaysSeries.map((p) => ({
      kind: 'forecast' as const,
      dateIso: p.dateIso,
      label: p.label,
      revenue: p.projectedRevenue,
      revenueLower: p.revenueLower,
      revenueUpper: p.revenueUpper,
      grossProfit: p.projectedGrossProfit,
      grossProfitLower: p.grossProfitLower,
      grossProfitUpper: p.grossProfitUpper,
    }));
    return [...hist, ...proj];
  }, [report.salesForecast]);

  const renderForecastCiChart = () => {
    const pts = combinedForecastPoints;
    const histCount = report.salesForecast.dailyHistorySeries.length;
    if (pts.length === 0 || histCount === 0) {
      return (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
          Record at least 1 sale invoice to visualize historical trend and 30-day confidence interval forecast.
        </div>
      );
    }

    const svgW = 760;
    const svgH = 250;
    const padL = 56;
    const padR = 16;
    const padT = 18;
    const padB = 34;
    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    const showRev = forecastSeriesMode === 'both' || forecastSeriesMode === 'revenue';
    const showGp = forecastSeriesMode === 'both' || forecastSeriesMode === 'gp';

    const vals: number[] = [0];
    pts.forEach((p) => {
      if (showRev) vals.push(p.revenue, p.revenueUpper, p.revenueLower);
      if (showGp) vals.push(p.grossProfit, p.grossProfitUpper, p.grossProfitLower);
    });
    const minVal = Math.min(0, ...vals);
    const maxVal = Math.max(100, ...vals);
    const range = Math.max(1, maxVal - minVal);

    const xAt = (idx: number) =>
      pts.length <= 1 ? padL + plotW / 2 : padL + (idx / (pts.length - 1)) * plotW;
    const yAt = (v: number) =>
      padT + plotH - ((v - minVal) / range) * plotH;

    const buildLinePath = (indices: number[], getter: (p: typeof pts[number]) => number) =>
      indices
        .map((i, pos) => `${pos === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(getter(pts[i])).toFixed(1)}`)
        .join(' ');

    const histIndices = pts.map((_, i) => i).filter((i) => i < histCount);
    const forecastIndices = pts
      .map((_, i) => i)
      .filter((i) => i >= Math.max(0, histCount - 1));

    const buildBandPolygon = (
      upperGetter: (p: typeof pts[number]) => number,
      lowerGetter: (p: typeof pts[number]) => number
    ) => {
      if (forecastIndices.length < 2) return '';
      const top = forecastIndices.map(
        (i) => `${xAt(i).toFixed(1)},${yAt(upperGetter(pts[i])).toFixed(1)}`
      );
      const bottom = [...forecastIndices]
        .reverse()
        .map((i) => `${xAt(i).toFixed(1)},${yAt(lowerGetter(pts[i])).toFixed(1)}`);
      return [...top, ...bottom].join(' ');
    };

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minVal + range * t);
    const splitX = histCount > 0 ? xAt(histCount - 1) : padL;
    const activeHover =
      hoveredForecastIdx !== null && pts[hoveredForecastIdx]
        ? pts[hoveredForecastIdx]
        : null;

    return (
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
            {showRev && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-600 inline-block" />
                <span>Revenue (Ex-GST) + 80% CI</span>
              </span>
            )}
            {showGp && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-600 inline-block" />
                <span>Gross Profit + 80% CI</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="w-3 h-0.5 border-t border-dashed border-slate-500 inline-block" />
              <span>30-Day Projection</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(
              [
                { id: 'both', label: 'Both' },
                { id: 'gp', label: 'Gross Profit' },
                { id: 'revenue', label: 'Revenue' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setForecastSeriesMode(opt.id)}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  forecastSeriesMode === opt.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-56 select-none"
            onMouseLeave={() => setHoveredForecastIdx(null)}
          >
            {/* Horizontal grid & Y-axis labels */}
            {yTicks.map((tickVal, idx) => {
              const y = yAt(tickVal);
              return (
                <g key={idx}>
                  <line
                    x1={padL}
                    x2={svgW - padR}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    className="fill-slate-400 tabular-nums"
                  >
                    {tickVal >= 1000
                      ? `₹${(tickVal / 1000).toFixed(1)}k`
                      : `₹${Math.round(tickVal)}`}
                  </text>
                </g>
              );
            })}

            {/* Forecast region backdrop & split divider */}
            <rect
              x={splitX}
              y={padT}
              width={Math.max(0, svgW - padR - splitX)}
              height={plotH}
              className="fill-slate-50/70 dark:fill-slate-800/30"
            />
            <line
              x1={splitX}
              x2={splitX}
              y1={padT}
              y2={padT + plotH}
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-600"
              strokeDasharray="4 3"
              strokeWidth="1"
            />
            <text
              x={Math.min(svgW - padR - 6, splitX + 6)}
              y={padT + 11}
              fontSize="9.5"
              className="fill-slate-500 font-semibold"
            >
              Next 30 Days Forecast (80% CI)
            </text>

            {/* Confidence interval shaded bands */}
            {showRev && forecastIndices.length >= 2 && (
              <polygon
                points={buildBandPolygon(
                  (p) => p.revenueUpper,
                  (p) => p.revenueLower
                )}
                fill="rgba(37, 99, 235, 0.14)"
              />
            )}
            {showGp && forecastIndices.length >= 2 && (
              <polygon
                points={buildBandPolygon(
                  (p) => p.grossProfitUpper,
                  (p) => p.grossProfitLower
                )}
                fill="rgba(16, 185, 129, 0.18)"
              />
            )}

            {/* Historical lines */}
            {showRev && histIndices.length >= 1 && (
              <path
                d={buildLinePath(histIndices, (p) => p.revenue)}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.2"
              />
            )}
            {showGp && histIndices.length >= 1 && (
              <path
                d={buildLinePath(histIndices, (p) => p.grossProfit)}
                fill="none"
                stroke="#059669"
                strokeWidth="2.2"
              />
            )}

            {/* Forecast dashed lines */}
            {showRev && forecastIndices.length >= 2 && (
              <path
                d={buildLinePath(forecastIndices, (p) => p.revenue)}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            )}
            {showGp && forecastIndices.length >= 2 && (
              <path
                d={buildLinePath(forecastIndices, (p) => p.grossProfit)}
                fill="none"
                stroke="#059669"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            )}

            {/* Historical data point dots */}
            {histIndices.map((idx) => (
              <g key={`dot-${idx}`}>
                {showRev && (
                  <circle
                    cx={xAt(idx)}
                    cy={yAt(pts[idx].revenue)}
                    r="2.8"
                    fill="#2563eb"
                  />
                )}
                {showGp && (
                  <circle
                    cx={xAt(idx)}
                    cy={yAt(pts[idx].grossProfit)}
                    r="2.8"
                    fill="#059669"
                  />
                )}
              </g>
            ))}

            {/* X-axis sparse date labels */}
            {pts.map((p, idx) => {
              const step = Math.max(1, Math.floor(pts.length / 7));
              if (idx !== 0 && idx !== pts.length - 1 && idx !== histCount - 1 && idx % step !== 0) {
                return null;
              }
              return (
                <text
                  key={`xl-${idx}`}
                  x={xAt(idx)}
                  y={svgH - 10}
                  textAnchor="middle"
                  fontSize="9.5"
                  className="fill-slate-400"
                >
                  {p.label}
                </text>
              );
            })}

            {/* Hover crosshair & invisible hit targets */}
            {hoveredForecastIdx !== null && pts[hoveredForecastIdx] && (
              <line
                x1={xAt(hoveredForecastIdx)}
                x2={xAt(hoveredForecastIdx)}
                y1={padT}
                y2={padT + plotH}
                stroke="#64748b"
                strokeWidth="1"
              />
            )}
            {pts.map((_, idx) => {
              const stepW = plotW / Math.max(1, pts.length);
              return (
                <rect
                  key={`hit-${idx}`}
                  x={xAt(idx) - stepW / 2}
                  y={padT}
                  width={Math.max(6, stepW)}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHoveredForecastIdx(idx)}
                />
              );
            })}
          </svg>
        </div>

        {/* Live Hover Readout / 30-Day CI Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-[11px] tabular-nums">
          {activeHover ? (
            <>
              <span className="font-bold text-slate-900 dark:text-white">
                {activeHover.label} ({activeHover.kind === 'history' ? 'Actual' : '30-Day Forecast'})
              </span>
              <div className="flex flex-wrap items-center gap-4">
                {showRev && (
                  <span className="text-blue-700 dark:text-blue-400 font-semibold">
                    Revenue: {fmt(activeHover.revenue)}
                    {activeHover.kind === 'forecast' &&
                      ` (${fmt(activeHover.revenueLower)} – ${fmt(activeHover.revenueUpper)})`}
                  </span>
                )}
                {showGp && (
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    Gross Profit: {fmt(activeHover.grossProfit)}
                    {activeHover.kind === 'forecast' &&
                      ` (${fmt(activeHover.grossProfitLower)} – ${fmt(activeHover.grossProfitUpper)})`}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                30-Day Projected Totals (80% Confidence Interval):
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-blue-700 dark:text-blue-400 font-semibold">
                  Revenue: {fmt(report.salesForecast.next30DaysRevenue)} (CI{' '}
                  {fmt(report.salesForecast.next30DaysRevenueLower)} –{' '}
                  {fmt(report.salesForecast.next30DaysRevenueUpper)})
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  Gross Profit: {fmt(report.salesForecast.next30DaysGrossProfit)} (CI{' '}
                  {fmt(report.salesForecast.next30DaysGrossProfitLower)} –{' '}
                  {fmt(report.salesForecast.next30DaysGrossProfitUpper)})
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const handleExportStatementCsv = () => {
    const generatedAt = new Date().toLocaleString('en-IN');
    const lines: string[][] = [
      ['Business Manager 360 - Trading & Profit & Loss Statement'],
      ['Business Name', company.name],
      ['GSTIN', company.gstin || 'Unregistered'],
      ['Period', report.dateCoverageLabel],
      ['Inventory Costing Method', report.costingMethodUsed],
      ['Generated On', generatedAt],
      [],
      ['Section', 'Line Item', 'Amount (INR)'],
      ['Trading Account', 'Opening Stock Valuation', String(pl.openingStockValue)],
      ['Trading Account', 'Gross Sales (Ex-GST)', String(pl.grossSalesExGst)],
      ['Trading Account', 'Less: Sales Returns', String(-pl.salesReturnsExGst)],
      ['Trading Account', 'Memo: Discounts Granted', String(pl.totalDiscounts)],
      ['Trading Account', 'Net Sales (Ex-GST)', String(pl.netSalesExGst)],
      ['Trading Account', 'Gross Purchases (Ex-GST)', String(pl.grossPurchasesExGst)],
      ['Trading Account', 'Less: Purchase Returns', String(-pl.purchaseReturnsExGst)],
      ['Trading Account', 'Direct Purchase Expenses (Freight/Handling)', String(pl.directPurchaseExpenses)],
      ['Trading Account', 'Net Purchases (Ex-GST)', String(pl.netPurchasesExGst)],
      ['Trading Account', 'Less: Closing Stock Valuation', String(-pl.closingStockValue)],
      ['Trading Account', 'Cost of Goods Sold (COGS)', String(pl.cogs)],
      ['Trading Account', 'Gross Profit', String(pl.grossProfit)],
      ['Trading Account', 'Gross Margin %', `${pl.grossMarginPercent}%`],
      ['Profit & Loss', 'Add: Other Income', String(pl.otherIncome)],
      ...pl.expenseByCategory.map((e) => [
        'Indirect Expense',
        e.category,
        String(-e.amount),
      ]),
      ['Profit & Loss', 'Total Indirect Expenses', String(-pl.indirectExpensesTotal)],
      ['Profit & Loss', 'Net Profit / (Loss)', String(pl.netProfit)],
      ['Profit & Loss', 'Net Margin %', `${pl.netMarginPercent}%`],
      ['GST Summary', 'Output GST Collected', String(pl.gstCollectedOutput)],
      ['GST Summary', 'Eligible Input Tax Credit (ITC)', String(pl.gstInputEligible)],
      ['GST Summary', 'Non-Creditable Tax Capitalized', String(pl.gstInputNonCreditable)],
      ['GST Summary', 'Net GST Liability', String(pl.netGstLiability)],
    ];

    const csv = lines
      .map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BM360_PL_Statement_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Trading & P&L Statement exported to CSV');
  };

  const handleExportStatementPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text((company.name || 'BUSINESS MANAGER 360').toUpperCase(), 14, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(
      `GSTIN: ${company.gstin || 'Unregistered'} | Costing Method: ${report.costingMethodUsed}`,
      14,
      17
    );
    doc.text(
      `Period: ${report.dateCoverageLabel} | Exported: ${new Date().toLocaleString('en-IN')}`,
      14,
      23
    );

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TRADING & PROFIT AND LOSS STATEMENT', 14, 37);

    const rows: Array<[string, string, string]> = [
      ['Trading Account', 'Opening Stock Valuation', fmtExact(pl.openingStockValue)],
      ['Trading Account', 'Gross Sales (Ex-GST)', fmtExact(pl.grossSalesExGst)],
      ['Trading Account', 'Less: Sales Returns', `- ${fmtExact(pl.salesReturnsExGst)}`],
      ['Trading Account', 'Net Sales Revenue (Ex-GST)', fmtExact(pl.netSalesExGst)],
      ['Trading Account', 'Gross Purchases (Ex-GST)', fmtExact(pl.grossPurchasesExGst)],
      ['Trading Account', 'Less: Purchase Returns', `- ${fmtExact(pl.purchaseReturnsExGst)}`],
      ['Trading Account', 'Direct Purchase Expenses', fmtExact(pl.directPurchaseExpenses)],
      ['Trading Account', 'Net Purchases (Ex-GST)', fmtExact(pl.netPurchasesExGst)],
      ['Trading Account', 'Closing Stock Valuation', fmtExact(pl.closingStockValue)],
      ['Trading Account', 'Cost of Goods Sold (COGS)', fmtExact(pl.cogs)],
      ['Gross Result', `Gross Profit (${pl.grossMarginPercent}%)`, fmtExact(pl.grossProfit)],
      ['Profit & Loss', 'Add: Other Operating Income', fmtExact(pl.otherIncome)],
      ...pl.expenseByCategory.map((e) => [
        'Indirect Expense',
        `${e.category} (${e.sharePercent}%)`,
        `- ${fmtExact(e.amount)}`,
      ] as [string, string, string]),
      ['Profit & Loss', 'Total Indirect Expenses', `- ${fmtExact(pl.indirectExpensesTotal)}`],
      ['Net Result', `Net Profit / Loss (${pl.netMarginPercent}%)`, fmtExact(pl.netProfit)],
    ];

    autoTable(doc, {
      startY: 42,
      head: [['Section', 'Particulars', 'Amount (INR)']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 36, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`BM360_Trading_PL_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('Trading & P&L Statement PDF downloaded');
  };

  const handleLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockLabel.trim() || !lockStart || !lockEnd) {
      showToast('Provide a period label, start date, and end date.', 'error');
      return;
    }
    if (lockEnd < lockStart) {
      showToast('End date must be on or after start date.', 'error');
      return;
    }
    setLockingBusy(true);
    const res = await lockFinancialPeriod(lockLabel.trim(), lockStart, lockEnd);
    setLockingBusy(false);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleConfirmPriceChange = () => {
    if (!priceConfirmRow) return;
    const parsed = Number(customRecommendedPrice);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast('Enter a valid positive selling price.', 'error');
      return;
    }
    const res = applyRecommendedItemPrice(
      priceConfirmRow.itemId,
      Math.round(parsed * 100) / 100,
      `AI Price Recommendation (${priceConfirmRow.reason})`
    );
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      setPriceConfirmRow(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Header & Period Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Advanced Profit &amp; Loss Engine
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>{report.dateCoverageLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Costing: {report.costingMethodUsed}</span>
            <span aria-hidden="true">·</span>
            <span>
              GST Basis:{' '}
              {businessSettings?.accounting?.profitControl?.gstBasisForProfit ||
                'Exclude Creditable GST'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {(
              [
                'Today',
                'Yesterday',
                'This Week',
                'This Month',
                'This Quarter',
                'This Year',
                'Financial Year',
                'Custom',
                'All Time',
              ] as PLPeriodFilter[]
            ).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  period === p
                    ? 'bg-[#8B0D1E] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {period === 'Financial Year' && (
            <select
              value={fyStartYear}
              onChange={(e) => setFyStartYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
            >
              {[2026, 2025, 2024].map((yr) => (
                <option key={yr} value={yr}>
                  FY {yr}-{String(yr + 1).slice(-2)}
                </option>
              ))}
            </select>
          )}

          {period === 'Custom' && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs bg-transparent focus:outline-none tabular-nums"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs bg-transparent focus:outline-none tabular-nums"
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary View Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 no-print">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'overview', label: 'Overview & Comparisons', icon: BarChart3 },
              { id: 'statement', label: 'Trading & P&L Statement', icon: FileSpreadsheet },
              { id: 'breakdowns', label: 'Product, Customer & Discounts', icon: Package },
              { id: 'reconciliation', label: 'Reconciliation & GST', icon: ShieldCheck },
              { id: 'ai-bi', label: 'AI Profit Optimizer & Health', icon: Sparkles },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeViewTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveViewTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportStatementCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportStatementPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* 1. OVERVIEW & COMPARISONS */}
      {activeViewTab === 'overview' && (
        <div className="space-y-5">
          {/* 6-KPI Top Equation Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Net Sales (Ex-GST)</span>
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {fmt(pl.netSalesExGst)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Returns: {fmt(pl.salesReturnsExGst)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/60 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <span>Gross Profit</span>
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                {fmt(pl.grossProfit)}
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 tabular-nums">
                {pl.grossMarginPercent}% margin · COGS {fmt(pl.cogs)}
              </div>
            </div>

            <div
              className={`bg-white dark:bg-slate-900 rounded-xl border p-4 ${
                pl.netProfit >= 0
                  ? 'border-blue-200 dark:border-blue-900/60'
                  : 'border-rose-200 dark:border-rose-900/60'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                <span>Net Profit</span>
                <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div
                className={`text-xl font-bold mt-1 tabular-nums ${
                  pl.netProfit >= 0
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {fmt(pl.netProfit)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Net Margin: {pl.netMarginPercent}%
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Net Purchases</span>
                <Package className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {fmt(pl.netPurchasesExGst)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Freight/Exp: {fmt(pl.directPurchaseExpenses)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Indirect Expenses</span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                {fmt(pl.indirectExpensesTotal)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Other Income: {fmt(pl.otherIncome)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Discounts &amp; Loss</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {fmt(report.discountAnalysis.totalDiscountsGiven)}
              </div>
              <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                {report.discountAnalysis.lossMakingInvoicesCount} loss bill(s)
              </div>
            </div>
          </div>

          {/* 4 Period Comparison Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                title: 'Today vs Yesterday',
                data: report.comparisons.todayVsYesterday,
              },
              {
                title: 'This Week vs Last Week',
                data: report.comparisons.weekVsLastWeek,
              },
              {
                title: 'This Month vs Last Month',
                data: report.comparisons.monthVsLastMonth,
              },
              {
                title: 'This Year vs Last Year',
                data: report.comparisons.yearVsLastYear,
              },
            ].map((comp) => {
              const salesUp = comp.data.salesGrowthPct >= 0;
              const profUp = comp.data.profitGrowthPct >= 0;
              return (
                <div
                  key={comp.title}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {comp.title}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {comp.data.current.label} Sales
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                        {fmt(comp.data.current.netSales)}
                      </div>
                      <div
                        className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums mt-0.5 ${
                          salesUp
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {salesUp ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        <span>
                          {salesUp ? '+' : ''}
                          {comp.data.salesGrowthPct}% vs{' '}
                          {fmt(comp.data.previous.netSales)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {comp.data.current.label} Net Profit
                      </div>
                      <div
                        className={`font-bold tabular-nums mt-0.5 ${
                          comp.data.current.netProfit >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {fmt(comp.data.current.netProfit)}
                      </div>
                      <div
                        className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums mt-0.5 ${
                          profUp
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {profUp ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        <span>
                          {profUp ? '+' : ''}
                          {comp.data.profitGrowthPct}% vs{' '}
                          {fmt(comp.data.previous.netProfit)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trend Chart + Cash vs Accrual Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Historical Trend &amp; 30-Day Profit / Revenue Projection
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Actual daily performance extended with 30-day linear projection and 80% confidence interval bands
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Confidence: {report.salesForecast.confidence} ({report.salesForecast.sampleActiveDays} active days)
                </span>
              </div>

              {renderForecastCiChart()}
            </div>

            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cash vs Accrual Profit &amp; Operating Cash Flow
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Cash Counter Sales
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmt(report.cashVsAccrual.cashSales)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    UPI, Bank &amp; Cheque Sales
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmt(report.cashVsAccrual.upiAndBankSales)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Credit / Udhaar Sales (Uncollected)
                  </span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                    {fmt(report.cashVsAccrual.creditSales)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Udhaar Collections Received
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {fmt(report.cashVsAccrual.cashReceivedFromCollections)}
                  </span>
                </div>
                <div className="py-2 flex justify-between font-bold">
                  <span>Operating Cash Flow</span>
                  <span
                    className={`tabular-nums ${
                      report.cashVsAccrual.operatingCashFlow >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {fmt(report.cashVsAccrual.operatingCashFlow)}
                  </span>
                </div>
                <div className="py-2 flex justify-between font-bold">
                  <span>Accrual Net Profit</span>
                  <span
                    className={`tabular-nums ${
                      report.cashVsAccrual.accrualNetProfit >= 0
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {fmt(report.cashVsAccrual.accrualNetProfit)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                {report.cashVsAccrual.cashProfitGapNote}
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs font-semibold">
                <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                  Receivables: {fmt(report.cashVsAccrual.customerReceivables)}
                </span>
                <span className="text-rose-600 dark:text-rose-400 tabular-nums">
                  Payables: {fmt(report.cashVsAccrual.supplierPayables)}
                </span>
              </div>
            </div>
          </div>

          {/* Automatic Profit Alerts */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Automated Profit &amp; Margin Alerts ({report.alerts.length})
              </h3>
            </div>
            {report.alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 py-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  All active profit, margin, expense, and inventory checks are within healthy thresholds.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.alerts.map((al) => (
                  <div
                    key={al.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            al.severity === 'critical'
                              ? 'text-rose-600 dark:text-rose-400'
                              : al.severity === 'warning'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          [{al.severity.toUpperCase()}]
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {al.title}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        {al.detail}
                      </p>
                    </div>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                      {al.metricValue}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. TRADING & P&L STATEMENT + PERIOD LOCKING */}
      {activeViewTab === 'statement' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Trading Account Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Trading Account (Cost of Goods Sold)
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {report.costingMethodUsed}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Gross Sales (Ex-GST)
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmtExact(pl.grossSalesExGst)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Less: Sales Returns / Credit Notes
                  </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                    - {fmtExact(pl.salesReturnsExGst)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Memo: Discounts Granted (Deducted in Net Sales)
                  </span>
                  <span className="tabular-nums text-amber-600 dark:text-amber-400">
                    {fmtExact(pl.totalDiscounts)}
                  </span>
                </div>
                <div className="py-2 flex justify-between font-bold text-slate-900 dark:text-white">
                  <span>Net Sales Revenue (Ex-GST)</span>
                  <span className="tabular-nums">{fmtExact(pl.netSalesExGst)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Opening Stock Valuation
                  </span>
                  <span className="tabular-nums">{fmtExact(pl.openingStockValue)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Gross Purchases (Ex-Creditable GST)
                  </span>
                  <span className="tabular-nums">{fmtExact(pl.grossPurchasesExGst)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Less: Purchase Returns
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 tabular-nums">
                    - {fmtExact(pl.purchaseReturnsExGst)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Add: Direct Purchase Freight &amp; Expenses
                  </span>
                  <span className="tabular-nums">
                    {fmtExact(pl.directPurchaseExpenses)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Less: Closing Stock Valuation
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    - {fmtExact(pl.closingStockValue)}
                  </span>
                </div>
                <div className="py-2 flex justify-between font-bold">
                  <span>Cost of Goods Sold (Historical COGS)</span>
                  <span className="tabular-nums text-rose-700 dark:text-rose-400">
                    {fmtExact(pl.cogs)}
                  </span>
                </div>
                <div className="py-3 flex justify-between text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  <span>Gross Profit ({pl.grossMarginPercent}% Margin)</span>
                  <span className="tabular-nums">{fmtExact(pl.grossProfit)}</span>
                </div>
              </div>
            </div>

            {/* Profit & Loss Account Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Indirect Income, Expenses &amp; Net Profit
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Accrual P&amp;L
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-2 flex justify-between font-semibold">
                  <span>Gross Profit Brought Forward</span>
                  <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                    {fmtExact(pl.grossProfit)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Add: Other Operating Income
                  </span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                    + {fmtExact(pl.otherIncome)}
                  </span>
                </div>

                {pl.expenseByCategory.length === 0 ? (
                  <div className="py-3 text-slate-400">
                    No indirect operating expenses recorded in this period.
                  </div>
                ) : (
                  pl.expenseByCategory.map((exp) => (
                    <div
                      key={exp.category}
                      className="py-2 flex justify-between items-center"
                    >
                      <span className="text-slate-600 dark:text-slate-300">
                        Less: {exp.category} ({exp.sharePercent}%)
                      </span>
                      <span className="tabular-nums text-rose-600 dark:text-rose-400">
                        - {fmtExact(exp.amount)}
                      </span>
                    </div>
                  ))
                )}

                <div className="py-2 flex justify-between font-bold">
                  <span>Total Indirect Expenses</span>
                  <span className="tabular-nums text-rose-600 dark:text-rose-400">
                    - {fmtExact(pl.indirectExpensesTotal)}
                  </span>
                </div>

                <div
                  className={`py-3 flex justify-between text-base font-bold ${
                    pl.netProfit >= 0
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  <span>
                    {pl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'} (
                    {pl.netMarginPercent}%)
                  </span>
                  <span className="tabular-nums">{fmtExact(pl.netProfit)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Output GST (Liability)
                  </span>
                  <span className="font-bold tabular-nums">
                    {fmtExact(pl.gstCollectedOutput)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Eligible Purchase ITC
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {fmtExact(pl.gstInputEligible)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Period Locking (Admin Only) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#8B0D1E]" />
                  <span>Financial Period Locking</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lock closed accounting periods to block backdated edits, additions, or cancellations.
                </p>
              </div>
              {!isAdminUser && (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Admin privileges required to lock/unlock periods
                </span>
              )}
            </div>

            {isAdminUser && (
              <form
                onSubmit={handleLockSubmit}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Period Label
                  </label>
                  <input
                    type="text"
                    value={lockLabel}
                    onChange={(e) => setLockLabel(e.target.value)}
                    placeholder="e.g. Oct 2026 Close"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={lockStart}
                    onChange={(e) => setLockStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={lockEnd}
                    onChange={(e) => setLockEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  disabled={lockingBusy}
                  className="px-4 py-2 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {lockingBusy ? 'Locking...' : 'Lock Financial Period'}
                </button>
              </form>
            )}

            {lockedPeriods.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {lockedPeriods.map((lp) => (
                  <div
                    key={lp.id}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {lp.label}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 ml-2 tabular-nums">
                        {lp.startDate} to {lp.endDate} · Locked by {lp.lockedBy}
                      </span>
                    </div>
                    {isAdminUser && (
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await unlockFinancialPeriod(lp.id);
                          showToast(r.message, r.success ? 'success' : 'error');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        <Unlock className="w-3 h-3" />
                        <span>Unlock</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                No locked financial periods configured yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. PRODUCT, CATEGORY, CUSTOMER & DISCOUNT BREAKDOWNS */}
      {activeViewTab === 'breakdowns' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  {
                    id: 'products',
                    label: `Products (${report.productRows.length})`,
                  },
                  {
                    id: 'categories',
                    label: `Categories (${report.categoryRows.length})`,
                  },
                  {
                    id: 'customers',
                    label: `Customers (${report.customerRows.length})`,
                  },
                  {
                    id: 'customer-product-brand',
                    label: `Customer × Product × Brand (${report.customerProductBrandRows.length})`,
                  },
                  {
                    id: 'discounts',
                    label: `Discount Impact & Approvals (${discountApprovals.length})`,
                  },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setBreakdownSubTab(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                    breakdownSubTab === st.id
                      ? 'bg-[#8B0D1E] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {breakdownSubTab === 'products' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search SKU or category..."
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none"
                />
                {(
                  [
                    { id: 'profit', label: 'Most Profitable' },
                    { id: 'loss', label: 'Least / Loss' },
                    { id: 'revenue', label: 'Highest Sales' },
                    { id: 'score', label: 'Perf. Score' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setProductSort(s.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      productSort === s.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {breakdownSubTab === 'customer-product-brand' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={cpbSearch}
                  onChange={(e) => setCpbSearch(e.target.value)}
                  placeholder="Search customer, product or brand..."
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none"
                />
                <select
                  value={cpbCustomerFilter}
                  onChange={(e) => setCpbCustomerFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  {cpbCustomers.map((c) => (
                    <option key={c} value={c}>
                      {c === 'All' ? 'All Customers' : c}
                    </option>
                  ))}
                </select>
                <select
                  value={cpbBrandFilter}
                  onChange={(e) => setCpbBrandFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  {cpbBrands.map((b) => (
                    <option key={b} value={b}>
                      {b === 'All' ? 'All Brands' : b}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {breakdownSubTab === 'products' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Net Qty</th>
                    <th className="px-4 py-2.5 text-right">Discounts</th>
                    <th className="px-4 py-2.5 text-right">Net Sales (Ex-GST)</th>
                    <th className="px-4 py-2.5 text-right">Historical COGS</th>
                    <th className="px-4 py-2.5 text-right">Gross Profit</th>
                    <th className="px-4 py-2.5 text-right">Margin %</th>
                    <th className="px-4 py-2.5 text-right">Score / Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No product sales recorded in selected period.
                      </td>
                    </tr>
                  ) : (
                    sortedProducts.map((row) => (
                      <tr
                        key={row.name}
                        className={
                          row.isLossMaking
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                          {row.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {row.category}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.netQty}
                          {row.returnedQty > 0 && (
                            <span className="text-[10px] text-rose-500 ml-1">
                              (-{row.returnedQty})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                          {fmt(row.discountsGiven)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmt(row.netSalesExGst)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                          {fmt(row.cogs)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                            row.grossProfit >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {fmt(row.grossProfit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {row.marginPercent}%
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className="font-bold">{row.performanceScore}</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span
                            className={
                              row.performanceTier === 'Loss-Making'
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : row.performanceTier === 'High Profit'
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-slate-600 dark:text-slate-300'
                            }
                          >
                            {row.performanceTier}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {breakdownSubTab === 'categories' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Net Units</th>
                    <th className="px-4 py-2.5 text-right">Net Sales (Ex-GST)</th>
                    <th className="px-4 py-2.5 text-right">COGS</th>
                    <th className="px-4 py-2.5 text-right">Gross Profit</th>
                    <th className="px-4 py-2.5 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.categoryRows.map((cat) => (
                    <tr key={cat.category}>
                      <td className="px-4 py-2.5 font-semibold">{cat.category}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {cat.netQty}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fmt(cat.netSales)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                        {fmt(cat.cogs)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                          cat.grossProfit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {fmt(cat.grossProfit)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {cat.marginPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {breakdownSubTab === 'customers' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">Customer / Party</th>
                    <th className="px-4 py-2.5 text-right">Bills</th>
                    <th className="px-4 py-2.5 text-right">Discounts Given</th>
                    <th className="px-4 py-2.5 text-right">Returns</th>
                    <th className="px-4 py-2.5 text-right">Net Revenue (Ex-GST)</th>
                    <th className="px-4 py-2.5 text-right">COGS</th>
                    <th className="px-4 py-2.5 text-right">Gross Profit</th>
                    <th className="px-4 py-2.5 text-right">Margin %</th>
                    <th className="px-4 py-2.5 text-right">Udhaar Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.customerRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No customer sales recorded in selected period.
                      </td>
                    </tr>
                  ) : (
                    report.customerRows.map((c) => (
                      <tr key={c.partyName}>
                        <td className="px-4 py-2.5 font-semibold">{c.partyName}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {c.invoiceCount}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                          {fmt(c.discountsGiven)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">
                          {fmt(c.returnsAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmt(c.netRevenueExGst)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                          {fmt(c.cogs)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                            c.grossProfit >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {fmt(c.grossProfit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {c.marginPercent}%
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmt(c.outstandingBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {breakdownSubTab === 'customer-product-brand' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">Customer</th>
                    <th className="px-4 py-2.5">Product / Item</th>
                    <th className="px-4 py-2.5">Brand</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Net Qty / Weight</th>
                    <th className="px-4 py-2.5 text-right">Discounts</th>
                    <th className="px-4 py-2.5 text-right">Net Revenue (Ex-GST)</th>
                    <th className="px-4 py-2.5 text-right">COGS</th>
                    <th className="px-4 py-2.5 text-right">Gross Profit</th>
                    <th className="px-4 py-2.5 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCustomerProductBrandRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No customer × product × brand sales match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerProductBrandRows.map((row) => (
                      <tr
                        key={row.key}
                        className={
                          row.grossProfit < -0.01
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                          {row.partyName}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                          {row.productName}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {row.brand}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                          {row.category}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.netQty} {row.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                          {fmt(row.discountsGiven)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmt(row.netRevenueExGst)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                          {fmt(row.cogs)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                            row.grossProfit >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {fmt(row.grossProfit)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {row.marginPercent}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {breakdownSubTab === 'discounts' && (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    Total Discounts Granted
                  </div>
                  <div className="text-lg font-bold tabular-nums mt-1">
                    {fmt(report.discountAnalysis.totalDiscountsGiven)}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {report.discountAnalysis.discountToGrossSalesPercent}% of Gross Sales
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    Product vs Invoice vs Coupon
                  </div>
                  <div className="text-xs font-semibold tabular-nums mt-1.5">
                    Line {fmt(report.discountAnalysis.productLevelDiscounts)} · Inv{' '}
                    {fmt(report.discountAnalysis.invoiceLevelDiscounts)} · Coupon{' '}
                    {fmt(report.discountAnalysis.couponDiscounts)}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/60">
                  <div className="text-rose-600 dark:text-rose-400">
                    Loss Caused by Discounting
                  </div>
                  <div className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
                    {fmt(report.discountAnalysis.lossCausedByDiscounts)}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {report.discountAnalysis.lossMakingInvoicesCount} loss-making invoice(s)
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 dark:text-slate-400">
                    Discount-to-Profit Ratio
                  </div>
                  <div className="text-lg font-bold tabular-nums mt-1">
                    {report.discountAnalysis.discountToGrossProfitPercent}%
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {report.discountAnalysis.overDiscountedInvoicesCount} bills above cap
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                  Admin Discount &amp; Loss-Sale Override Audit Log
                </h4>
                {discountApprovals.length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 py-4">
                    No Admin PIN discount or loss-sale approvals logged yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Invoice #</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2 text-right">Discount</th>
                          <th className="px-3 py-2 text-right">Loss Impact</th>
                          <th className="px-3 py-2">Approved By</th>
                          <th className="px-3 py-2">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {discountApprovals.map((ap) => (
                          <tr key={ap.id}>
                            <td className="px-3 py-2 font-mono font-semibold">
                              {ap.invoiceNo}
                            </td>
                            <td className="px-3 py-2">{ap.partyName}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              {ap.reason}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {fmt(ap.discountAmount)} ({ap.discountPercent}%)
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-bold tabular-nums ${
                                ap.lossAmount <= 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {ap.lossAmount > 0 ? `-${fmt(ap.lossAmount)}` : '₹0 (Margin Cap)'}
                            </td>
                            <td className="px-3 py-2">{ap.approvedBy}</td>
                            <td className="px-3 py-2 tabular-nums text-slate-500">
                              {new Date(ap.timestamp).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. RECONCILIATION & GST SUMMARY */}
      {activeViewTab === 'reconciliation' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Output GST Collected (Net of Returns)
              </div>
              <div className="text-xl font-bold mt-1 tabular-nums">
                {fmtExact(pl.gstCollectedOutput)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Eligible Input Tax Credit (ITC)
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {fmtExact(pl.gstInputEligible)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Non-Creditable Input Tax (In Cost)
              </div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {fmtExact(pl.gstInputNonCreditable)}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Net GST Payable (GSTR-3B Est.)
              </div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-1 tabular-nums">
                {fmtExact(pl.netGstLiability)}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Automated Financial &amp; Stock Reconciliation Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cross-verifies Invoices, Purchase Bills, Double-Entry Journal Vouchers, Inventory Cost Completeness, and GST ITC.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Audit Area</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Expected / Register</th>
                    <th className="px-4 py-2.5 text-right">Ledger / Actual</th>
                    <th className="px-4 py-2.5 text-right">Difference</th>
                    <th className="px-4 py-2.5">Detail</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.reconciliationChecks.map((chk) => (
                    <tr key={chk.id}>
                      <td className="px-4 py-3 font-semibold">{chk.area}</td>
                      <td className="px-4 py-3 font-bold">
                        <span
                          className={
                            chk.status === 'Matched'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : chk.status === 'Variance'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {chk.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {chk.id === 'rec-inv-cost'
                          ? `${chk.expectedValue} SKUs`
                          : fmtExact(chk.expectedValue)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {chk.id === 'rec-inv-cost'
                          ? `${chk.actualValue} SKUs`
                          : fmtExact(chk.actualValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {chk.id === 'rec-inv-cost'
                          ? `${chk.difference} flagged`
                          : fmtExact(chk.difference)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-md">
                        {chk.detail}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveTab(chk.targetTab)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Open Module
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. AI PROFIT OPTIMIZER & BUSINESS HEALTH */}
      {activeViewTab === 'ai-bi' && (
        <div className="space-y-5">
          {/* Health Scorecard + Forecast + Expense Optimizer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Weighted Business Health Index
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Transparent 5-factor formula computed directly from live store metrics
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {report.businessHealth.overallScore} / 100
                  </div>
                  <div
                    className={`text-xs font-bold ${
                      report.businessHealth.grade === 'Excellent' ||
                      report.businessHealth.grade === 'Good'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : report.businessHealth.grade === 'Watch'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {report.businessHealth.grade}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {report.businessHealth.factors.map((f) => (
                  <div
                    key={f.factor}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {f.factor} ({f.weightPercent}%)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {f.observedMetric}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className="font-bold">{f.scoreOutOf100}/100</div>
                      <div className="text-[11px] text-slate-500">
                        +{f.weightedPoints} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Sales &amp; Gross Profit Forecast
                  </h3>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Confidence: {report.salesForecast.confidence}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Next 7 Days Sales
                    </div>
                    <div className="text-base font-bold tabular-nums mt-0.5">
                      {fmt(report.salesForecast.next7DaysRevenue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Next 7 Days GP
                    </div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                      {fmt(report.salesForecast.next7DaysGrossProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Next 30 Days Sales
                    </div>
                    <div className="text-base font-bold tabular-nums mt-0.5">
                      {fmt(report.salesForecast.next30DaysRevenue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Next 30 Days GP
                    </div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                      {fmt(report.salesForecast.next30DaysGrossProfit)}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {report.salesForecast.notice}
                </p>
                {renderForecastCiChart()}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Expense Optimizer
                  </h3>
                  <span className="text-xs font-semibold tabular-nums">
                    Exp/Sales: {report.expenseOptimizer.expenseToSalesRatioPct}% · MoM:{' '}
                    {report.expenseOptimizer.momChangePct >= 0 ? '+' : ''}
                    {report.expenseOptimizer.momChangePct}%
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                  {report.expenseOptimizer.insights.map((ins, i) => (
                    <li key={i}>{ins}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Smart Selling Price Recommender */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#8B0D1E]" />
                  <span>Smart Selling Price Recommender</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Identifies below-cost or low-margin SKUs. Price changes always require explicit Admin confirmation and record price history.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Item Name</th>
                    <th className="px-4 py-2.5 text-right">Effective Cost</th>
                    <th className="px-4 py-2.5 text-right">Current Sale Price</th>
                    <th className="px-4 py-2.5 text-right">Unit GP / Margin</th>
                    <th className="px-4 py-2.5 text-right">Min Safe Price</th>
                    <th className="px-4 py-2.5 text-right">Recommended Price</th>
                    <th className="px-4 py-2.5">Status / Reason</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.priceRecommendations.slice(0, 20).map((rec) => (
                    <tr
                      key={rec.itemId}
                      className={
                        rec.status === 'Loss-Making'
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : ''
                      }
                    >
                      <td className="px-4 py-2.5 font-semibold">{rec.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fmtExact(
                          report.costingMethodUsed === 'Last Purchase Price'
                            ? rec.currentPurchasePrice
                            : rec.weightedAvgCost
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {fmtExact(rec.currentSalePrice)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-bold ${
                          rec.currentGrossProfitPerUnit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {fmtExact(rec.currentGrossProfitPerUnit)} ({rec.currentMarginPercent}%)
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fmt(rec.minProfitablePrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-blue-700 dark:text-blue-400">
                        {fmt(rec.recommendedSalePrice)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`font-semibold ${
                            rec.status === 'Loss-Making'
                              ? 'text-rose-600 dark:text-rose-400'
                              : rec.status === 'Below Target'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {rec.status}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                          {rec.reason}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isAdminUser &&
                        rec.recommendedSalePrice !== Math.round(rec.currentSalePrice) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPriceConfirmRow(rec);
                              setCustomRecommendedPrice(
                                String(rec.recommendedSalePrice)
                              );
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Apply Price
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dead Stock & Slow-Moving Inventory Analyzer */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Dead Stock &amp; Capital Blocked Analyzer
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total Capital Blocked: {fmt(report.deadStockAnalysis.totalCapitalBlocked)} · 90+d:{' '}
                  {report.deadStockAnalysis.count90Days} · 60–89d:{' '}
                  {report.deadStockAnalysis.count60Days} · 30–59d:{' '}
                  {report.deadStockAnalysis.count30Days}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Item</th>
                    <th className="px-4 py-2.5 text-right">Stock</th>
                    <th className="px-4 py-2.5 text-right">Unit Cost</th>
                    <th className="px-4 py-2.5 text-right">Capital Blocked</th>
                    <th className="px-4 py-2.5 text-right">Days Since Sale</th>
                    <th className="px-4 py-2.5">Bucket</th>
                    <th className="px-4 py-2.5">Suggested Clearance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.deadStockAnalysis.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No slow-moving, dead, overstocked, or expiring items detected.
                      </td>
                    </tr>
                  ) : (
                    report.deadStockAnalysis.rows.slice(0, 20).map((d) => (
                      <tr key={d.itemId}>
                        <td className="px-4 py-2.5 font-semibold">{d.name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {d.stock} {d.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {fmtExact(d.unitCost)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                          {fmt(d.capitalBlocked)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {d.daysSinceLastSale === null
                            ? 'Never sold'
                            : `${d.daysSinceLastSale}d`}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-amber-700 dark:text-amber-400">
                          {d.bucket}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {d.recommendation}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Confirmation Modal for Applying Recommended Sale Price */}
      {priceConfirmRow && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4"
          onClick={() => setPriceConfirmRow(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-5 space-y-4 shadow-2xl text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Confirm Admin Price Update
              </h3>
              <button
                type="button"
                onClick={() => setPriceConfirmRow(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <div>
                Product: <strong className="text-slate-900 dark:text-white">{priceConfirmRow.name}</strong>
              </div>
              <div>
                Current Sale Price:{' '}
                <strong className="tabular-nums">{fmtExact(priceConfirmRow.currentSalePrice)}</strong> · Min Safe Price:{' '}
                <strong className="tabular-nums">{fmt(priceConfirmRow.minProfitablePrice)}</strong>
              </div>
              <p className="text-[11px] text-slate-500">{priceConfirmRow.reason}</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">
                New Sale Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={customRecommendedPrice}
                onChange={(e) => setCustomRecommendedPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold tabular-nums"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPriceConfirmRow(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPriceChange}
                className="px-4 py-2 rounded-lg bg-[#8B0D1E] hover:bg-[#740918] text-white font-bold cursor-pointer"
              >
                Update Sale Price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
