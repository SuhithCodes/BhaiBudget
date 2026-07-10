"use client"

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { type Expense, type Income } from "@/types";
import { ExpenseList } from "@/components/expenses/expense-list";
import { Loader2, Calendar as CalendarIcon, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { deleteExpense, updateExpense } from "@/lib/actions/expenses";
import { type ExpenseFormData, type IncomeFormData } from "@/types";
import { IncomeList } from "@/components/income/income-list";
import { deleteIncome, updateIncome } from "@/lib/actions/incomes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isDateInRange } from "@/lib/date-range";

export default function TransactionsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [incomes, setIncomes] = useState<Income[]>([]);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [selectedMonth, setSelectedMonth] = useState<string>("all");

    useEffect(() => {
        if (user) {
            const qExpenses = query(collection(db, "expenses"), where("userId", "==", user.uid), orderBy("date", "desc"));
            const qIncomes = query(collection(db, "incomes"), where("userId", "==", user.uid), orderBy("date", "desc"));
            const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
                const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
                setExpenses(expensesData);
                setIsLoading(false);
            }, () => setIsLoading(false));
            const unsubIncomes = onSnapshot(qIncomes, (snapshot) => {
                const incomesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
                setIncomes(incomesData);
                setIsLoading(false);
            }, () => setIsLoading(false));

            return () => {
                unsubExpenses();
                unsubIncomes();
            };
        } else {
            setIsLoading(false);
        }
    }, [user]);

    const uniqueCategories = useMemo(() => {
        const categories = new Set(expenses.map(e => e.category));
        return ["all", ...Array.from(categories)];
    }, [expenses]);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        [...expenses, ...incomes].forEach(transaction => {
            // Use the YYYY-MM prefix directly — parseISO would shift the day
            // (and sometimes the month) in west-of-UTC timezones.
            months.add(transaction.date.slice(0, 7));
        });
        return ["all", ...Array.from(months).sort().reverse()];
    }, [expenses, incomes]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;
            const matchesSearch = expense.vendorName.toLowerCase().includes(searchQuery.toLowerCase());

            const expenseMonth = expense.date.slice(0, 7);
            const matchesMonth = selectedMonth === 'all' || expenseMonth === selectedMonth;

            const matchesDate = isDateInRange(expense.date, dateRange);

            return matchesCategory && matchesSearch && matchesDate && matchesMonth;
        });
    }, [expenses, searchQuery, selectedCategory, dateRange, selectedMonth]);

    const filteredIncomes = useMemo(() => {
        return incomes.filter(income => {
            const matchesSearch = income.sourceName.toLowerCase().includes(searchQuery.toLowerCase());

            const incomeMonth = income.date.slice(0, 7);
            const matchesMonth = selectedMonth === 'all' || incomeMonth === selectedMonth;

            const matchesDate = isDateInRange(income.date, dateRange);

            return matchesSearch && matchesDate && matchesMonth;
        });
    }, [incomes, searchQuery, dateRange, selectedMonth]);

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

    return (
        <main className="flex flex-1 flex-col gap-6 p-4 px-0 sm:px-4 md:gap-8 md:p-8 w-full max-w-screen-2xl">
            <div className="px-4 sm:px-0">
                <h1 className="font-headline text-2xl font-semibold tracking-tight">Transactions</h1>
                <p className="text-sm text-muted-foreground mt-1">View and filter all your expenses and income.</p>
            </div>

            <Card className="border-x-0 sm:border-x rounded-none sm:rounded-xl shadow-none sm:shadow-sm">
                {/* Filter bar */}
                <CardHeader className="border-b pb-4">
                    <div className="grid gap-3 md:grid-cols-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                className="pl-9 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {uniqueCategories.map(category => (
                                    <SelectItem key={category} value={category}>
                                        {category === 'all' ? 'All Categories' : category}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map(month => (
                                    <SelectItem key={month} value={month}>
                                        {month === 'all' ? 'All Months' : format(new Date(month + '-01T12:00:00'), 'MMMM yyyy')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className="h-9 w-full justify-start text-left font-normal text-sm">
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            `${format(dateRange.from, "LLL dd")} – ${format(dateRange.to, "LLL dd, y")}`
                                        ) : (
                                            format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span className="text-muted-foreground">Date range</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>

                <CardContent className="pt-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Tabs defaultValue="expenses">
                            <TabsList className="mb-2">
                                <TabsTrigger value="expenses">Expenses ({filteredExpenses.length})</TabsTrigger>
                                <TabsTrigger value="incomes">Income ({filteredIncomes.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="expenses">
                                <ExpenseList
                                    expenses={filteredExpenses}
                                    showTitle={false}
                                    showExport={true}
                                    onExpenseDeleted={handleExpenseDeleted}
                                    onExpenseUpdated={handleExpenseUpdated}
                                />
                            </TabsContent>
                            <TabsContent value="incomes">
                                <IncomeList
                                    incomes={filteredIncomes}
                                    showTitle={false}
                                    showExport={true}
                                    onIncomeDeleted={async (id) => { await deleteIncome(id); setIncomes((prev) => prev.filter(i => i.id !== id)); }}
                                    onIncomeUpdated={async (id, data) => { await updateIncome(id, data); setIncomes((prev) => prev.map(i => i.id === id ? { ...i, ...data, id } as Income : i)); }}
                                />
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>
        </main>
    );
} 