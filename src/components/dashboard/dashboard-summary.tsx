"use client"

import { ReceiptText, TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type Expense, type Income } from "@/types"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface DashboardSummaryProps {
  expenses: Expense[];
  incomes?: Income[];
}

export function DashboardSummary({ expenses, incomes = [] }: DashboardSummaryProps) {
  const totalSpending = expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
  const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0);
  const netBalance = totalIncome - totalSpending;
  const totalExpenses = expenses.length;
  const totalIncomes = incomes.length;
  const totalTransactions = totalExpenses + totalIncomes;
  const uniqueCategories = new Set(expenses.map(e => e.category)).size;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Income Card */}
      <Card className="overflow-hidden relative">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <TrendingUp className="h-16 w-16 text-emerald-500" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalIncome)}
          </div>
          <p className="text-[10px] font-medium text-muted-foreground mt-1 flex items-center gap-1">
            <span className="text-emerald-500">{totalIncomes}</span> payments this period
          </p>
        </CardContent>
      </Card>

      {/* Spending Card */}
      <Card className="overflow-hidden relative">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <TrendingDown className="h-16 w-16 text-red-500" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
            {formatCurrency(totalSpending)}
          </div>
          <p className="text-[10px] font-medium text-muted-foreground mt-1 flex items-center gap-1">
            <span className="text-red-500">{totalExpenses}</span> expenses this period
          </p>
        </CardContent>
      </Card>

      {/* Net Balance Card */}
      <Card className="overflow-hidden relative">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <Wallet className="h-16 w-16 text-muted-foreground" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-bold tracking-tight",
            netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}>
            {formatCurrency(netBalance)}
          </div>
          <p className="text-[10px] font-medium text-muted-foreground mt-1 flex items-center gap-1">
            <span className={netBalance >= 0 ? "text-emerald-500" : "text-red-500"}>
              {netBalance >= 0 ? 'Surplus' : 'Deficit'}
            </span> relative to income
          </p>
        </CardContent>
      </Card>

      {/* Transactions Card */}
      <Link href="/dashboard/transactions" className="block h-full group">
        <Card className="hover:border-primary/50 transition-all active:scale-[0.98] h-full overflow-hidden relative border-dashed">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <ReceiptText className="h-16 w-16 transition-transform group-hover:scale-110" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight group-hover:text-primary transition-colors">{totalTransactions}</div>
            <p className="text-[10px] font-medium text-muted-foreground mt-1">
              Across <span className="font-semibold">{uniqueCategories}</span> categories
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

