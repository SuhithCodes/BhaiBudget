"use client"

import { DollarSign, ReceiptText, Tags, TrendingUp, TrendingDown, Wallet } from "lucide-react"
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Income</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground">
            {totalIncomes} transaction{totalIncomes !== 1 ? 's' : ''} in period
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Spending</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalSpending)}
          </div>
          <p className="text-xs text-muted-foreground">
            {totalExpenses} expense{totalExpenses !== 1 ? 's' : ''} in period
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-bold",
            netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}>
            {formatCurrency(netBalance)}
          </div>
          <p className="text-xs text-muted-foreground">
            {netBalance >= 0 ? 'Surplus' : 'Deficit'} for this period
          </p>
        </CardContent>
      </Card>
      <Link href="/dashboard/transactions">
        <Card className="hover:bg-muted/50 transition-colors h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">
              {uniqueCategories} categor{uniqueCategories !== 1 ? 'ies' : 'y'}
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
