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
import { DateRange } from "react-day-picker"
import { subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, startOfDay, endOfDay } from "date-fns"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { ResponsiveSankey } from "@/components/dashboard/responsive-sankey"
import { PARENT_CATEGORIES as PARENT_CATEGORIES_CONST } from "@/lib/constants"
import { VoiceTransactionAgent } from "@/components/voice/voice-transaction-agent"

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

    const recentExpenses = useMemo(() => expenses.slice(0, 5), [expenses]);

    const handleExpenseAdded = async (newExpenseData: ExpenseFormData) => {
        if (!user) return;

        try {
            const expenseWithUser = { ...newExpenseData, userId: user.uid };
            await addDoc(collection(db, "expenses"), expenseWithUser);
            setIsFormOpen(false);
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
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not update expense." });
        }
    };

    const setDatePreset = (preset: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'last7Days' | 'thisMonth' | 'thisQuarter' | 'thisYear') => {
        const now = new Date();
        switch (preset) {
            case 'today':
                setDateRange({ from: startOfDay(now), to: endOfDay(now) });
                break;
            case 'yesterday':
                const yesterday = subDays(now, 1);
                setDateRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
                break;
            case 'thisWeek':
                setDateRange({ from: startOfWeek(now), to: endOfWeek(now) });
                break;
            case 'lastWeek':
                const lastWeekStart = startOfWeek(subDays(now, 7));
                const lastWeekEnd = endOfWeek(subDays(now, 7));
                setDateRange({ from: lastWeekStart, to: lastWeekEnd });
                break;
            case 'last7Days':
                setDateRange({ from: subDays(now, 6), to: now });
                break;
            case 'thisMonth':
                setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
                break;
            case 'thisQuarter':
                setDateRange({ from: startOfQuarter(now), to: endOfQuarter(now) });
                break;
            case 'thisYear':
                setDateRange({ from: startOfYear(now), to: endOfYear(now) });
                break;
        }
    };

    const filteredExpenses = useMemo(() => {
        if (!dateRange?.from) return expenses;
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from); // If no 'to' date, use 'from' date for single day selection
        return expenses.filter(expense => {
            const expenseDate = new Date(expense.date + 'T00:00:00');
            return expenseDate >= fromDate && expenseDate <= toDate;
        });
    }, [expenses, dateRange]);

    const filteredIncomes = useMemo(() => {
        if (!dateRange?.from) return incomes;
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        return incomes.filter(income => {
            const incomeDate = new Date(income.date + 'T00:00:00');
            return incomeDate >= fromDate && incomeDate <= toDate;
        });
    }, [incomes, dateRange]);

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
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 container mx-auto">
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
        <>
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 container mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="font-headline text-3xl font-semibold">Dashboard</h1>
                    <div className="flex items-center gap-2">
                        <Dialog open={isIncomeFormOpen} onOpenChange={setIsIncomeFormOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Banknote className="mr-2 h-4 w-4" />
                                    Add Income
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[95vh] overflow-y-auto p-4 sm:p-6">
                                <DialogHeader className="mb-4">
                                    <DialogTitle>Add New Income</DialogTitle>
                                    <DialogDescription>
                                        Record money you received.
                                    </DialogDescription>
                                </DialogHeader>
                                <IncomeForm onSubmit={handleIncomeAdded} />
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Expense
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[95vh] overflow-y-auto p-4 sm:p-6">
                                <DialogHeader className="mb-4">
                                    <DialogTitle>Add New Expense</DialogTitle>
                                    <DialogDescription>
                                        Upload or scan a receipt to automatically extract expense details.
                                    </DialogDescription>
                                </DialogHeader>
                                <ExpenseForm onSubmit={handleExpenseAdded} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <div className="grid gap-8">
                    <div className="flex flex-wrap items-center gap-2">
                        <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="flex items-center gap-2">
                                    <span>Presets</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setDatePreset('today')}>Today</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDatePreset('yesterday')}>Yesterday</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDatePreset('thisWeek')}>This Week</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDatePreset('lastWeek')}>Last Week</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDatePreset('last7Days')}>Last 7 Days</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDatePreset('thisMonth')}>This Month</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDatePreset('thisQuarter')}>This Quarter</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setDatePreset('thisYear')}>This Year</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <DashboardSummary expenses={filteredExpenses} incomes={filteredIncomes} />
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
                        <div className="lg:col-span-3">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Financial Flow</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[400px] w-full p-0">
                                    {sankeyData.nodes.length > 1 && sankeyData.links.length > 0 ? (
                                        <ResponsiveSankey data={sankeyData} height={400} />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <p className="text-center">No data for this period. <br /> Try adjusting the date filter.</p>
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
            <VoiceTransactionAgent />
        </>
    )
}
