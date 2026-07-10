"use client"

import { useState, useEffect, useMemo } from "react"
import { ExpenseForm } from "@/components/expenses/expense-form"
import { ExpenseList } from "@/components/expenses/expense-list"
import { DashboardSummary } from "@/components/dashboard/dashboard-summary"
import { SankeyDiagram, type SankeyData } from "@/components/dashboard/sankey-diagram";
import { type Expense, type ExpenseFormData } from "@/types"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { PlusCircle, Banknote, Calendar as CalendarIcon } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot, addDoc, orderBy } from "firebase/firestore"
import { Skeleton } from "@/components/ui/skeleton"
import { deleteExpense, updateExpense } from "@/lib/actions/expenses"
import { IncomeForm } from "@/components/income/income-form"
import { type IncomeFormData, type Income } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { checkBudgetAlerts } from "@/lib/check-budget-alerts"
import { notifyExpenseAdded, notifyIncomeAdded } from "@/lib/push-notifications"
import { DateRange } from "react-day-picker"
import { startOfMonth, endOfMonth } from "date-fns"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { ResponsiveSankey } from "@/components/dashboard/responsive-sankey"
import { PARENT_CATEGORIES as PARENT_CATEGORIES_CONST } from "@/lib/constants"
import {
    filterByDateRange,
    formatRangeLabel,
    getDatePresetRange,
    type DatePreset,
} from "@/lib/date-range"


export default function DashboardPage() {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isIncomeFormOpen, setIsIncomeFormOpen] = useState(false);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const { toast } = useToast();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    useEffect(() => {
        if (user) {
            setIsLoading(true);
            const qExpenses = query(
                collection(db, "expenses"),
                where("userId", "==", user.uid),
                orderBy("date", "desc"),
            );
            const qIncomes = query(
                collection(db, "incomes"),
                where("userId", "==", user.uid),
                orderBy("date", "desc"),
            );
            const unsubExpenses = onSnapshot(qExpenses, (querySnapshot) => {
                const expensesData: Expense[] = [];
                querySnapshot.forEach((doc) => {
                    expensesData.push({ id: doc.id, ...doc.data() } as Expense);
                });
                setExpenses(expensesData);
                setIsLoading(false);
            }, () => setIsLoading(false));
            const unsubIncomes = onSnapshot(qIncomes, (querySnapshot) => {
                const incomesData: Income[] = [];
                querySnapshot.forEach((doc) => {
                    incomesData.push({ id: doc.id, ...doc.data() } as Income);
                });
                setIncomes(incomesData);
                setIsLoading(false);
            }, () => setIsLoading(false));

            return () => {
                unsubExpenses();
                unsubIncomes();
            }
        } else {
            setExpenses([]);
            setIncomes([]);
            setIsLoading(false);
        }
    }, [user]);

    const recentExpenses = useMemo(
        () => filterByDateRange(expenses, dateRange).slice(0, 5),
        [expenses, dateRange],
    );

    const handleExpenseAdded = async (newExpenseData: ExpenseFormData) => {
        if (!user) return;

        try {
            const expenseWithUser = { ...newExpenseData, userId: user.uid };
            await addDoc(collection(db, "expenses"), expenseWithUser);
            setIsFormOpen(false);

            // Push notification
            notifyExpenseAdded(newExpenseData.vendorName, newExpenseData.totalAmount);

            // Check budget alerts (fire-and-forget)
            checkBudgetAlerts(user.uid, newExpenseData.category).catch(() => { });
        } catch (error) {
            console.error("Error adding expense: ", error);
        }
    };

    const handleIncomeAdded = async (newIncomeData: IncomeFormData) => {
        if (!user) return;
        try {
            const incomeWithUser = { ...newIncomeData, userId: user.uid };
            await addDoc(collection(db, "incomes"), incomeWithUser);
            setIsIncomeFormOpen(false);

            // Push notification
            notifyIncomeAdded(newIncomeData.sourceName, newIncomeData.amount);
        } catch (error) {
            console.error("Error adding income: ", error);
        }
    };

    const handleExpenseDeleted = async (expenseId: string) => {
        try {
            await deleteExpense(expenseId);
            setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
            toast({ title: "Success", description: "Expense deleted." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete expense." });
        }
    };

    const handleExpenseUpdated = async (expenseId: string, data: ExpenseFormData) => {
        try {
            await updateExpense(expenseId, data);
            setExpenses((prev) => prev.map((e) => e.id === expenseId ? { ...e, ...data, id: expenseId } : e));
            toast({ title: "Success", description: "Expense updated." });
            if (user) {
                checkBudgetAlerts(user.uid, data.category).catch(() => { });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not update expense." });
        }
    };

    const setDatePreset = (preset: DatePreset) => {
        setDateRange(getDatePresetRange(preset));
    };

    const filteredExpenses = useMemo(
        () => filterByDateRange(expenses, dateRange),
        [expenses, dateRange],
    );

    const filteredIncomes = useMemo(
        () => filterByDateRange(incomes, dateRange),
        [incomes, dateRange],
    );

    const periodLabel = useMemo(() => formatRangeLabel(dateRange), [dateRange]);

    const sankeyData = useMemo((): SankeyData => {
        const PARENT_CATS: Record<string, string[]> = {};
        for (const key in PARENT_CATEGORIES_CONST) {
            PARENT_CATS[key] = [...PARENT_CATEGORIES_CONST[key]];
        }

        // Build a reverse lookup: child category → parent category
        const childToParent: Record<string, string> = {};
        for (const parent in PARENT_CATS) {
            for (const child of PARENT_CATS[parent]) {
                childToParent[child] = parent;
            }
        }

        const nodes: { nodeId: string; name: string }[] = [];
        const links: { source: string; target: string; value: number }[] = [];

        // --- Income side ---
        const totalIncome = filteredIncomes.reduce((acc, income) => acc + (income.amount ?? 0), 0);

        // FIX #5: Use ?? instead of || so that 0-value expenses aren't dropped
        const expenseByCategory: { [key: string]: number } = {};
        filteredExpenses.forEach(expense => {
            const amount = expense.totalAmount ?? 0;
            if (amount <= 0) return;
            if (expenseByCategory[expense.category]) {
                expenseByCategory[expense.category] += amount;
            } else {
                expenseByCategory[expense.category] = amount;
            }
        });

        const totalExpenses = Object.values(expenseByCategory).reduce((acc, a) => acc + a, 0);

        // FIX #2: Always create the central node when there's any data
        if (totalIncome === 0 && totalExpenses === 0) {
            return { nodes: [], links: [] };
        }

        // FIX #4: Prefix all node IDs to prevent collisions between income sources,
        // parent categories, child categories, and special nodes.
        const CENTRAL_ID = "central-budget";
        nodes.push({ nodeId: CENTRAL_ID, name: "Budget" });

        // Income sources → Central node
        if (totalIncome > 0) {
            const incomeBySource: { [key: string]: number } = {};
            filteredIncomes.forEach(income => {
                const source = income.sourceName || 'Other Income';
                incomeBySource[source] = (incomeBySource[source] || 0) + (income.amount ?? 0);
            });

            for (const source in incomeBySource) {
                const nodeId = `inc-${source}`;
                nodes.push({ nodeId, name: source });
                links.push({ source: nodeId, target: CENTRAL_ID, value: incomeBySource[source] });
            }
        }

        // FIX #1: If expenses > income, add a deficit node to balance the flows
        if (totalExpenses > totalIncome) {
            const deficit = totalExpenses - totalIncome;
            const deficitId = "special-deficit";
            nodes.push({ nodeId: deficitId, name: "Deficit" });
            links.push({ source: deficitId, target: CENTRAL_ID, value: deficit });
        }

        // FIX #3: Route uncategorized expenses into "Other"
        for (const category in expenseByCategory) {
            if (!childToParent[category]) {
                if (!PARENT_CATS['Other'].includes(category)) {
                    PARENT_CATS['Other'].push(category);
                    childToParent[category] = 'Other';
                }
            }
        }

        // Central node → Parent categories → Child categories
        const parentCategoryTotals: { [key: string]: number } = {};
        for (const parent in PARENT_CATS) {
            parentCategoryTotals[parent] = 0;
            for (const child of PARENT_CATS[parent]) {
                if (expenseByCategory[child]) {
                    parentCategoryTotals[parent] += expenseByCategory[child];
                }
            }
        }

        for (const parent in parentCategoryTotals) {
            if (parentCategoryTotals[parent] > 0) {
                const parentId = `parent-${parent}`;
                nodes.push({ nodeId: parentId, name: parent });
                links.push({ source: CENTRAL_ID, target: parentId, value: parentCategoryTotals[parent] });

                for (const child of PARENT_CATS[parent]) {
                    if (expenseByCategory[child]) {
                        const childId = `cat-${child}`;
                        nodes.push({ nodeId: childId, name: child });
                        links.push({ source: parentId, target: childId, value: expenseByCategory[child] });
                    }
                }
            }
        }

        // FIX #6: Rename computed savings to "Unspent Income" to differentiate
        // from the "Savings & Investments" expense category
        const unspent = totalIncome - totalExpenses;
        if (unspent > 0) {
            const unspentId = "special-unspent";
            nodes.push({ nodeId: unspentId, name: "Unspent Income" });
            links.push({ source: CENTRAL_ID, target: unspentId, value: unspent });
        }

        return { nodes, links };
    }, [filteredIncomes, filteredExpenses]);

    if (isLoading) {
        return (
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 w-full max-w-screen-2xl">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-36" />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                </div>
                <div className="grid gap-8 lg:grid-cols-5">
                    <Skeleton className="lg:col-span-3 h-[500px]" />
                    <div className="lg:col-span-2 grid gap-8 auto-rows-min">
                        <Skeleton className="h-80" />
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 w-full max-w-screen-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="font-headline text-2xl font-semibold tracking-tight">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Overview of your financial flows and spending habits.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={isIncomeFormOpen} onOpenChange={setIsIncomeFormOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9">
                                <Banknote className="mr-2 h-3.5 w-3.5" />
                                Add Income
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[95vh] overflow-y-auto p-4 sm:p-6">
                            <DialogHeader className="mb-4">
                                <DialogTitle>Add New Income</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Record money you received to track your total earnings.
                                </DialogDescription>
                            </DialogHeader>
                            <IncomeForm onSubmit={handleIncomeAdded} />
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="h-9">
                                <PlusCircle className="mr-2 h-3.5 w-3.5" />
                                Add Expense
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[95vh] overflow-y-auto p-4 sm:p-6">
                            <DialogHeader className="mb-4">
                                <DialogTitle>Add New Expense</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Scan a receipt or enter details manually to track your spending.
                                </DialogDescription>
                            </DialogHeader>
                            <ExpenseForm onSubmit={handleExpenseAdded} />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-2 rounded-lg border border-transparent hover:border-muted-foreground/10 transition-colors">
                    <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground">
                                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                Quick Presets
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground font-semibold py-1.5">Date Range Presets</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-sm cursor-pointer" onSelect={() => setDatePreset('today')}>Today</DropdownMenuItem>
                            <DropdownMenuItem className="text-sm cursor-pointer" onSelect={() => setDatePreset('yesterday')}>Yesterday</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-sm cursor-pointer" onSelect={() => setDatePreset('thisWeek')}>This Week</DropdownMenuItem>
                            <DropdownMenuItem className="text-sm cursor-pointer" onSelect={() => setDatePreset('lastWeek')}>Last Week</DropdownMenuItem>
                            <DropdownMenuItem className="text-sm cursor-pointer" onSelect={() => setDatePreset('last7Days')}>Last 7 Days</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-sm cursor-pointer font-medium" onSelect={() => setDatePreset('thisMonth')}>This Month</DropdownMenuItem>
                            <DropdownMenuItem className="text-sm cursor-pointer" onSelect={() => setDatePreset('thisQuarter')}>This Quarter</DropdownMenuItem>
                            <DropdownMenuItem className="text-sm cursor-pointer" onSelect={() => setDatePreset('thisYear')}>This Year</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <DashboardSummary
                    expenses={filteredExpenses}
                    incomes={filteredIncomes}
                    allExpenses={expenses}
                    allIncomes={incomes}
                    periodLabel={periodLabel}
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                    <div className="lg:col-span-3">
                        <Card className="h-full overflow-hidden">
                            <CardHeader className="border-b pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg">Financial Flow</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">Sankey diagram of income vs allocation.</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="h-[430px] w-full p-0">
                                {sankeyData.nodes.length > 1 && sankeyData.links.length > 0 ? (
                                    <div className="h-full">
                                        <ResponsiveSankey data={sankeyData} height={400} />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5">
                                        <p className="text-center text-sm font-medium">Insufficient data for visualization.</p>
                                        <p className="text-center text-[11px] mt-1">Add both balance and expenses to see the flow.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-2">
                        <ExpenseList
                            expenses={recentExpenses}
                            onExpenseDeleted={handleExpenseDeleted}
                            onExpenseUpdated={handleExpenseUpdated}
                        />
                    </div>
                </div>
            </div>
        </main>
    )
}

