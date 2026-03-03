"use client";

import { forwardRef } from "react";
import { type ReportData } from "@/ai/flows/generate-monthly-report";
import { format, parseISO } from "date-fns";

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

        return (
            <div
                ref={ref}
                className="bg-white text-gray-900 p-8 max-w-3xl mx-auto space-y-8"
                style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
            >
                {/* ── Header ── */}
                <div className="text-center border-b-2 border-gray-200 pb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        Financial Summary Report
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {startLabel} — {endLabel}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Generated on {generatedLabel}
                    </p>
                </div>

                {/* ── Financial Overview ── */}
                <div>
                    <h2 className="text-lg font-semibold mb-3 text-gray-800">
                        Financial Overview
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            label="Income"
                            value={fmt(data.overview.totalIncome)}
                            color="text-emerald-700"
                        />
                        <StatCard
                            label="Spending"
                            value={fmt(data.overview.totalSpending)}
                            color="text-red-700"
                        />
                        <StatCard
                            label="Net Balance"
                            value={fmt(data.overview.netBalance)}
                            color={data.overview.netBalance >= 0 ? "text-emerald-700" : "text-red-700"}
                        />
                        <StatCard
                            label="Savings Rate"
                            value={`${data.overview.savingsRate.toFixed(1)}%`}
                            color={data.overview.savingsRate >= 0 ? "text-emerald-700" : "text-red-700"}
                        />
                    </div>
                </div>

                {/* ── Spending by Category ── */}
                {data.spendingByCategory.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-3 text-gray-800">
                            Spending by Category
                        </h2>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-left text-gray-500">
                                    <th className="py-2 font-medium">Category</th>
                                    <th className="py-2 font-medium text-right">Amount</th>
                                    <th className="py-2 font-medium text-right">% of Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.spendingByCategory.map((c) => (
                                    <tr key={c.category} className="border-b border-gray-100">
                                        <td className="py-2">{c.category}</td>
                                        <td className="py-2 text-right font-medium">
                                            {fmt(c.amount)}
                                        </td>
                                        <td className="py-2 text-right text-gray-500">
                                            {c.percentage.toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-semibold border-t-2 border-gray-300">
                                    <td className="py-2">Total</td>
                                    <td className="py-2 text-right">
                                        {fmt(data.overview.totalSpending)}
                                    </td>
                                    <td className="py-2 text-right">100%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* ── Budget Performance ── */}
                {data.budgetPerformance.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-3 text-gray-800">
                            Budget Performance
                        </h2>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-left text-gray-500">
                                    <th className="py-2 font-medium">Budget</th>
                                    <th className="py-2 font-medium text-right">Limit</th>
                                    <th className="py-2 font-medium text-right">Spent</th>
                                    <th className="py-2 font-medium text-right">Remaining</th>
                                    <th className="py-2 font-medium text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.budgetPerformance.map((b) => (
                                    <tr key={b.name} className="border-b border-gray-100">
                                        <td className="py-2">
                                            {b.name}
                                            <span className="text-gray-400 text-xs ml-1">
                                                ({b.period})
                                            </span>
                                        </td>
                                        <td className="py-2 text-right">{fmt(b.limit)}</td>
                                        <td className="py-2 text-right font-medium">
                                            {fmt(b.spent)}
                                        </td>
                                        <td className="py-2 text-right">{fmt(b.remaining)}</td>
                                        <td className="py-2 text-center">
                                            {b.status === "on-track"
                                                ? "✅"
                                                : b.status === "warning"
                                                    ? "⚠️"
                                                    : "🚨"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Savings Goals ── */}
                {data.savingsGoals.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-3 text-gray-800">
                            Savings Goals
                        </h2>
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
                                        <td className="py-2">
                                            {g.name}
                                            {g.deadline && (
                                                <span className="text-gray-400 text-xs ml-1">
                                                    (by {format(parseISO(g.deadline), "MMM yyyy")})
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 text-right">{fmt(g.target)}</td>
                                        <td className="py-2 text-right font-medium">
                                            {fmt(g.current)}
                                        </td>
                                        <td className="py-2 text-right">
                                            <span
                                                className={
                                                    g.progressPercent >= 100
                                                        ? "text-emerald-700 font-semibold"
                                                        : ""
                                                }
                                            >
                                                {g.progressPercent.toFixed(0)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── AI Insights ── */}
                {data.aiInsights.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-3 text-gray-800">
                            AI Insights
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {data.aiInsights.map((insight, i) => (
                                <div
                                    key={i}
                                    className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex gap-3"
                                >
                                    <span className="text-2xl flex-shrink-0">{insight.emoji}</span>
                                    <div>
                                        <p className="font-semibold text-sm text-gray-900">
                                            {insight.title}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">
                                            {insight.detail}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="text-center pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-400">
                        Generated by YABA • {generatedLabel}
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
