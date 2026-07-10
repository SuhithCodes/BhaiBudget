"use client";

import { forwardRef, useMemo } from "react";
import { type ReportData } from "@/ai/flows/generate-monthly-report";
import { format, parseISO, eachDayOfInterval, differenceInDays } from "date-fns";
import { SankeyDiagram } from "@/components/dashboard/sankey-diagram";
import { PARENT_CATEGORIES } from "@/lib/constants";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, RadialBarChart, RadialBar, Cell, ReferenceLine } from "recharts";

interface ReportPreviewProps {
    data: ReportData;
}

const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export const ReportPreview = forwardRef<HTMLDivElement, ReportPreviewProps>(
    ({ data }, ref) => {
        const startLabel = format(parseISO(data.dateRange.start), "MMM dd, yyyy");
        const endLabel = format(parseISO(data.dateRange.end), "MMM dd, yyyy");
        const generatedLabel = format(parseISO(data.generatedAt), "MMM dd, yyyy 'at' h:mm a");

        // --- Data Processors ---
        const sankeyData = useMemo(() => {
            // ... (keep existing sankey logic)
            const PARENT_CATS: Record<string, string[]> = {};
            for (const key in PARENT_CATEGORIES) PARENT_CATS[key] = [...PARENT_CATEGORIES[key]];

            const childToParent: Record<string, string> = {};
            for (const parent in PARENT_CATS) {
                for (const child of PARENT_CATS[parent]) childToParent[child] = parent;
            }

            const nodes: { nodeId: string; name: string }[] = [];
            const links: { source: string; target: string; value: number }[] = [];

            const totalIncome = (data.rawIncomes || []).reduce((acc, i) => acc + (i.amount ?? 0), 0);
            const expenseByCategory: Record<string, number> = {};
            (data.rawExpenses || []).forEach(e => {
                const amt = e.totalAmount ?? 0;
                if (amt > 0) expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + amt;
            });
            const totalExpenses = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);

            if (totalIncome === 0 && totalExpenses === 0) return { nodes: [], links: [] };

            const CENTRAL_ID = "central-budget";
            nodes.push({ nodeId: CENTRAL_ID, name: "Budget" });

            if (totalIncome > 0) {
                const incomeBySource: Record<string, number> = {};
                (data.rawIncomes || []).forEach(i => {
                    const src = i.sourceName || 'Other Income';
                    incomeBySource[src] = (incomeBySource[src] || 0) + (i.amount ?? 0);
                });
                for (const src in incomeBySource) {
                    nodes.push({ nodeId: `inc-${src}`, name: src });
                    links.push({ source: `inc-${src}`, target: CENTRAL_ID, value: incomeBySource[src] });
                }
            }

            if (totalExpenses > totalIncome) {
                const deficit = totalExpenses - totalIncome;
                nodes.push({ nodeId: "special-deficit", name: "Deficit" });
                links.push({ source: "special-deficit", target: CENTRAL_ID, value: deficit });
            }

            for (const category in expenseByCategory) {
                if (!childToParent[category]) {
                    if (!PARENT_CATS['Other']?.includes(category)) {
                        PARENT_CATS['Other'] = PARENT_CATS['Other'] || [];
                        PARENT_CATS['Other'].push(category);
                        childToParent[category] = 'Other';
                    }
                }
            }

            const parentCategoryTotals: Record<string, number> = {};
            for (const parent in PARENT_CATS) {
                parentCategoryTotals[parent] = 0;
                for (const child of PARENT_CATS[parent]) {
                    if (expenseByCategory[child]) parentCategoryTotals[parent] += expenseByCategory[child];
                }
            }

            for (const parent in parentCategoryTotals) {
                if (parentCategoryTotals[parent] > 0) {
                    const pid = `parent-${parent}`;
                    nodes.push({ nodeId: pid, name: parent });
                    links.push({ source: CENTRAL_ID, target: pid, value: parentCategoryTotals[parent] });
                }
            }

            for (const category in expenseByCategory) {
                if (expenseByCategory[category] > 0) {
                    const pid = `parent-${childToParent[category]}`;
                    const cid = `child-${category}`;
                    nodes.push({ nodeId: cid, name: category });
                    links.push({ source: pid, target: cid, value: expenseByCategory[category] });
                }
            }

            if (totalIncome > totalExpenses) {
                const unallocated = totalIncome - totalExpenses;
                nodes.push({ nodeId: "special-unallocated", name: "Unallocated" });
                links.push({ source: CENTRAL_ID, target: "special-unallocated", value: unallocated });
            }

            return { nodes, links };
        }, [data.rawExpenses, data.rawIncomes]);

        const liquidityData = useMemo(() => {
            const startDate = parseISO(data.dateRange.start);
            const endDate = parseISO(data.dateRange.end);
            const days = eachDayOfInterval({ start: startDate, end: endDate });

            // No opening balance is persisted, so the trend is a running
            // period net starting at $0 — NOT (totalNetWorth - netBalance),
            // which collapsed to 0 once totalNetWorth was correctly set equal
            // to netBalance and made the chart look empty/broken.
            let currentBalance = 0;

            return days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const incomeOnDay = (data.rawIncomes || [])
                    .filter(i => i.date === dateStr)
                    .reduce((sum, i) => sum + (i.amount ?? 0), 0);
                const expenseOnDay = (data.rawExpenses || [])
                    .filter(e => e.date === dateStr)
                    .reduce((sum, e) => sum + (e.totalAmount ?? 0), 0);

                currentBalance += (incomeOnDay - expenseOnDay);

                return {
                    time: format(day, 'MMM dd'),
                    bal: currentBalance,
                };
            });
        }, [data]);

        const periodDays = Math.max(
            1,
            differenceInDays(parseISO(data.dateRange.end), parseISO(data.dateRange.start)) + 1,
        );
        const burnPerDay = data.overview.totalSpending / periodDays;
        const bufferDays = burnPerDay > 0 && data.overview.netBalance > 0
            ? Math.round(data.overview.netBalance / burnPerDay)
            : 0;

        const chartBudgets = useMemo(() => {
            const result = [...data.budgetPerformance];
            if (result.length < 5) {
                const existingCats = new Set(result.map(b => b.category));
                data.spendingByCategory
                    .filter(s => !existingCats.has(s.category))
                    .slice(0, 5 - result.length)
                    .forEach(s => {
                        result.push({
                            name: s.category,
                            category: s.category,
                            period: 'monthly',
                            limit: 0,
                            spent: s.amount,
                            remaining: -s.amount,
                            status: 'over-budget'
                        });
                    });
            }
            return result.slice(0, 5);
        }, [data.budgetPerformance, data.spendingByCategory]);

        return (
            <div
                ref={ref}
                className="bg-white text-gray-900 p-8 max-w-3xl mx-auto space-y-8"
                style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
            >
                {/* ── Header ── */}
                <div className="flex justify-between items-baseline border-b-2 border-amber-600 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-amber-600 font-serif">
                            Financial Report
                        </h1>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">
                            {startLabel} — {endLabel}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {generatedLabel}
                        </p>
                    </div>
                </div>

                {/* ── EXECUTIVE SUMMARY ── */}
                <div className="space-y-6">
                    {/* ── KPI Row ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Period Net" value={fmt(data.overview.netBalance)} color={data.overview.netBalance >= 0 ? "text-emerald-700" : "text-red-700"} />
                        <StatCard label="Period Spending" value={fmt(data.overview.totalSpending)} color="text-red-700" />
                        <StatCard label="Savings Rate" value={`${data.overview.savingsRate.toFixed(1)}%`} color={data.overview.savingsRate >= 0 ? "text-emerald-700" : "text-red-700"} />
                        <StatCard label="Days of Buffer" value={bufferDays > 0 ? `${bufferDays} days` : '—'} color={bufferDays > 30 ? "text-sky-700" : "text-amber-700"} />
                    </div>

                    {/* Critical Alerts */}
                    <div className="space-y-3">
                        {data.topLeaks && data.topLeaks.length > 0 ? (
                            data.topLeaks.map((leak, idx) => (
                                <div key={idx} className="bg-amber-50 border-l-4 border-red-500 p-3 rounded-r-md">
                                    <p className="text-sm text-gray-800">
                                        <strong>Leak Detected:</strong> Your <span className="font-semibold">{leak.category}</span> spending is <span className="text-red-600 font-semibold">{fmt(leak.overage)}</span> over limit.
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-md">
                                <p className="text-sm text-emerald-800">
                                    <strong>All systems green.</strong> Budget is strictly adhered to.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* AI Insights & Optimizer */}
                    {data.aiInsights.length > 0 && (
                        <div className="bg-sky-50 border-l-4 border-sky-400 p-5 rounded-r-lg mt-6">
                            <h3 className="text-lg font-semibold text-sky-900 mb-4">AI Wealth Optimizer Recommendation</h3>
                            <div className="space-y-4">
                                {data.aiInsights.map((insight, i) => (
                                    <div key={i} className="flex gap-3 items-start">
                                        <span className="text-xl">{insight.emoji}</span>
                                        <div>
                                            <p className="font-semibold text-sm text-gray-900">{insight.title}</p>
                                            <p className="text-sm text-gray-700 mt-1">{insight.detail}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {data.topLeaks && data.topLeaks.length > 0 && (
                                <div className="mt-5 pt-4 border-t border-sky-200">
                                    <p className="text-sm text-sky-900">
                                        If you reduce your top {data.topLeaks.length} leak categories by 20%, you will accelerate your savings by <strong>{fmt((data.topLeaks.reduce((s, l) => s + l.overage, 0) * 0.2))}/mo</strong>, hitting your targets 20% faster.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Liquidity Trend (Full Width) ── */}
                <div className="pt-6 border-t border-dashed border-gray-200">
                    <h2 className="text-lg font-bold font-serif mb-3 text-gray-800">
                        Liquidity Trend
                    </h2>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4" style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={liquidityData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={30} />
                                <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={45} />
                                <RechartsTooltip formatter={(v) => [fmt(v as number), 'Balance']} labelStyle={{ fontWeight: 'bold' }} />
                                <ReferenceLine y={data.overview.totalSpending * 0.5} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Safe Harbor', fill: '#ef4444', fontSize: 10 }} />
                                <Area type="monotone" dataKey="bal" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorBal)" activeDot={{ r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── Two Column: Spending & Budget ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Spending Breakdown Table (Compact) */}
                    <div>
                        <h2 className="text-lg font-bold font-serif mb-3 text-gray-800">Spending Breakdown</h2>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-hidden">
                            <table className="w-full text-xs">
                                <thead className="border-b border-gray-200 text-left text-gray-500">
                                    <tr>
                                        <th className="py-2">Category</th>
                                        <th className="py-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.spendingByCategory.slice(0, 8).map((c) => (
                                        <tr key={c.category} className="border-b border-gray-100 last:border-0">
                                            <td className="py-2 truncate max-w-[120px]">{c.category}</td>
                                            <td className="py-2 text-right font-medium">{fmt(c.amount)}</td>
                                        </tr>
                                    ))}
                                    {data.spendingByCategory.length === 0 && (
                                        <tr><td colSpan={2} className="py-8 text-center text-gray-400">No expenses tracked yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Budget vs Actual Chart (Refined) */}
                    <div>
                        <h2 className="text-lg font-bold font-serif mb-3 text-gray-800">Budget vs. Actual</h2>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4" style={{ height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartBudgets} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                                    <Bar dataKey="limit" fill="#e2e8f0" barSize={12} radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="spent" barSize={12} radius={[0, 4, 4, 0]}>
                                        {chartBudgets.map((entry, index) => {
                                            const ratio = entry.limit > 0 ? entry.spent / entry.limit : (entry.spent > 0 ? 1.1 : 0);
                                            const color = ratio > 1 ? '#ef4444' : ratio > 0.8 ? '#f59e0b' : '#10b981';
                                            return <Cell key={`cell-v-${index}`} fill={color} />;
                                        })}
                                    </Bar>
                                    {chartBudgets.map((entry, index) => {
                                        const ratio = entry.limit > 0 ? (entry.spent / entry.limit) * 100 : 0;
                                        const variance = entry.limit > 0 ? entry.limit - entry.spent : -entry.spent;
                                        const ratioText = entry.limit > 0 ? `${ratio.toFixed(0)}%` : 'No Budget';
                                        return (
                                            <text key={`lv-${index}`} x={280} y={22 + index * 42} textAnchor="end" fontSize={9} fill={variance >= 0 ? "#10b981" : "#ef4444"} fontWeight="bold">
                                                {ratioText} ({fmt(variance)})
                                            </text>
                                        );
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* ── Detailed Tables (Detailed view) ── */}
                <div className="space-y-8 pt-6 border-t border-gray-100">
                    {/* Budget Performance Table */}
                    {data.budgetPerformance.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3 text-gray-800">Budget Performance Details</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-gray-500">
                                        <th className="py-2 font-medium">Budget</th>
                                        <th className="py-2 font-medium text-right">Limit</th>
                                        <th className="py-2 font-medium text-right">Spent</th>
                                        <th className="py-2 font-medium text-right">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.budgetPerformance.map((b) => (
                                        <tr key={b.name} className="border-b border-gray-100">
                                            <td className="py-2">{b.name}</td>
                                            <td className="py-2 text-right">{fmt(b.limit)}</td>
                                            <td className="py-2 text-right font-medium">{fmt(b.spent)}</td>
                                            <td className={`py-2 text-right ${b.remaining >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(b.remaining)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Savings Goals Table */}
                    {data.savingsGoals.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-3 text-gray-800">Savings Goals Track</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-gray-500">
                                        <th className="py-2 font-medium">Goal</th>
                                        <th className="py-2 font-medium text-right">Target</th>
                                        <th className="py-2 font-medium text-right">Saved</th>
                                        <th className="py-2 font-medium text-right">Progress</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.savingsGoals.map((g) => (
                                        <tr key={g.name} className="border-b border-gray-100">
                                            <td className="py-2">{g.name}</td>
                                            <td className="py-2 text-right">{fmt(g.target)}</td>
                                            <td className="py-2 text-right font-medium">{fmt(g.current)}</td>
                                            <td className="py-2 text-right font-bold text-emerald-700">{g.progressPercent.toFixed(0)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Financial Flow (Sankey) ── Moved to New Page */}
                <div style={{ breakBefore: 'page', pageBreakBefore: 'always' }} className="pt-8">
                    <h2 className="text-xl font-bold font-serif mb-6 text-gray-800 text-center">
                        Cash Flow Topology
                    </h2>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center justify-center" style={{ height: 400 }}>
                        {sankeyData.nodes.length > 0 ? (
                            <SankeyDiagram
                                data={sankeyData}
                                width={640}
                                height={360}
                                textColor="#111827"
                                secondaryColor="#6b7280"
                            />
                        ) : (
                            <p className="text-sm text-gray-400">Not enough data for chart.</p>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="text-center pt-8 border-t border-gray-200">
                    <p className="text-xs text-gray-400 font-medium tracking-widest uppercase">
                        Refined by YABA • {generatedLabel}
                    </p>
                </div>
            </div>
        );
    }
);

ReportPreview.displayName = "ReportPreview";

function StatCard({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
    );
}
