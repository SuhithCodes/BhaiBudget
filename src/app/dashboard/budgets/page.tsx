"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Loader2, Star, Target } from 'lucide-react';
import { BudgetList } from '@/components/budgets/budget-list';
import { BudgetForm } from '@/components/budgets/budget-form';
import { SavingsGoalList } from '@/components/savings-goals/savings-goal-list';
import { SavingsGoalForm } from '@/components/savings-goals/savings-goal-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Budget, type BudgetFormData, type SavingsGoal, type SavingsGoalFormData } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { addBudget, deleteBudget, updateBudget } from '@/lib/actions/budgets';
import { addSavingsGoal, getSavingsGoals, deleteSavingsGoal, updateSavingsGoal } from '@/lib/actions/savings-goals';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Expense } from '@/types';

export default function BudgetsAndGoalsPage() {
    const { user } = useAuth();
    const { toast } = useToast();

    // Budget state
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);

    // Savings goal state
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);

    const [isLoading, setIsLoading] = useState(true);

    // ── Data fetching ──────────────────────────────────────────────
    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        let loadedCount = 0;
        const totalSources = 3; // budgets, expenses, savings goals
        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount >= totalSources) setIsLoading(false);
        };

        // Real-time listener for budgets
        const unsubscribeBudgets = onSnapshot(
            query(collection(db, 'budgets'), where('userId', '==', user.uid)),
            (snapshot) => {
                const budgetsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Budget));
                setBudgets(budgetsData);
                checkLoaded();
            },
            (error) => {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch budgets.' });
                checkLoaded();
            }
        );

        // Real-time listener for expenses (needed by budget calculations)
        const unsubscribeExpenses = onSnapshot(
            query(collection(db, 'expenses'), where('userId', '==', user.uid), orderBy('date', 'desc')),
            (snapshot) => {
                const expensesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Expense));
                setExpenses(expensesData);
                checkLoaded();
            },
            (error) => {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch expenses.' });
                checkLoaded();
            }
        );

        // Fetch savings goals
        async function fetchGoals() {
            try {
                const userGoals = await getSavingsGoals(user!.uid);
                setGoals(userGoals);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch savings goals.' });
            } finally {
                checkLoaded();
            }
        }
        fetchGoals();

        return () => {
            unsubscribeBudgets();
            unsubscribeExpenses();
        };
    }, [user, toast]);

    // ── Budget handlers ────────────────────────────────────────────
    const handleBudgetAdded = async (newBudgetData: BudgetFormData) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to create a budget.' });
            return;
        }

        const duplicate = budgets.find(
            (b) => b.category === newBudgetData.category && b.period === newBudgetData.period
        );
        if (duplicate) {
            toast({
                variant: 'destructive',
                title: 'Duplicate Budget',
                description: `A ${newBudgetData.period.toLowerCase()} budget for "${newBudgetData.category}" already exists ("${duplicate.name}"). Please edit the existing one instead.`,
            });
            return;
        }

        try {
            await addBudget(newBudgetData, user.uid);
            setIsBudgetFormOpen(false);
            toast({ title: 'Budget Created', description: `Your budget for "${newBudgetData.name}" has been created.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create budget.' });
        }
    };

    const handleBudgetDeleted = async (budgetId: string) => {
        try {
            await deleteBudget(budgetId);
            toast({ title: 'Budget Deleted', description: 'Your budget has been deleted.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete budget.' });
        }
    };

    const handleBudgetUpdated = async (budgetId: string, budgetData: BudgetFormData) => {
        try {
            await updateBudget(budgetId, budgetData);
            toast({ title: 'Budget Updated', description: `Your budget for "${budgetData.name}" has been updated.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update budget.' });
        }
    };

    // ── Savings goal handlers ──────────────────────────────────────
    const handleGoalAdded = async (newGoalData: SavingsGoalFormData) => {
        if (!user) return;
        try {
            const newGoal = await addSavingsGoal(newGoalData, user.uid);
            setGoals((prev) => [...prev, newGoal]);
            setIsGoalFormOpen(false);
            toast({ title: 'Success', description: 'Savings goal created.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create goal.' });
        }
    };

    const handleGoalDeleted = async (goalId: string) => {
        try {
            await deleteSavingsGoal(goalId);
            setGoals((prev) => prev.filter((g) => g.id !== goalId));
            toast({ title: 'Success', description: 'Savings goal deleted.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete goal.' });
        }
    };

    const handleGoalUpdated = async (goalId: string, updatedData: Partial<SavingsGoalFormData>) => {
        try {
            await updateSavingsGoal(goalId, updatedData);
            setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, ...updatedData } : g));
            toast({ title: 'Success', description: 'Savings goal updated.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update goal.' });
        }
    };

    // ── Render ──────────────────────────────────────────────────────
    return (
        <main className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 w-full max-w-screen-2xl">
            <div>
                <h1 className="font-headline text-2xl font-semibold tracking-tight">Budgets &amp; Goals</h1>
                <p className="text-sm text-muted-foreground mt-1">Track spending limits and savings targets.</p>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <Tabs defaultValue="budgets" className="w-full">
                    <TabsList className="grid w-full max-w-sm grid-cols-2 mb-2">
                        <TabsTrigger value="budgets" className="flex items-center gap-2">
                            <Target className="h-3.5 w-3.5" />
                            Budgets
                        </TabsTrigger>
                        <TabsTrigger value="savings" className="flex items-center gap-2">
                            <Star className="h-3.5 w-3.5" />
                            Savings Goals
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Budgets Tab ── */}
                    <TabsContent value="budgets">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                                <div>
                                    <CardTitle className="text-lg">Your Budgets</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-1">{budgets.length} active budget{budgets.length !== 1 ? 's' : ''}</p>
                                </div>
                                <Dialog open={isBudgetFormOpen} onOpenChange={setIsBudgetFormOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="h-8">
                                            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                                            New Budget
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Create a New Budget</DialogTitle>
                                        </DialogHeader>
                                        <BudgetForm onSubmit={handleBudgetAdded} />
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <BudgetList
                                    budgets={budgets}
                                    expenses={expenses}
                                    onBudgetDeleted={handleBudgetDeleted}
                                    onBudgetUpdated={handleBudgetUpdated}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Savings Goals Tab ── */}
                    <TabsContent value="savings">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                                <div>
                                    <CardTitle className="text-lg">Savings Goals</CardTitle>
                                    <p className="text-xs text-muted-foreground mt-1">{goals.length} active goal{goals.length !== 1 ? 's' : ''}</p>
                                </div>
                                <Dialog open={isGoalFormOpen} onOpenChange={setIsGoalFormOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="h-8">
                                            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                                            New Goal
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Create a New Savings Goal</DialogTitle>
                                        </DialogHeader>
                                        <SavingsGoalForm onGoalAdded={handleGoalAdded} />
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <SavingsGoalList
                                    goals={goals}
                                    onGoalDeleted={handleGoalDeleted}
                                    onGoalUpdated={handleGoalUpdated}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </main>
    );
}
