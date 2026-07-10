"use client"

import { type Budget, type Expense, type BudgetFormData } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { BudgetForm } from "./budget-form";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { getBudgetSpent, getPeriodDateRange } from "@/lib/budget-spent";
import { cn } from "@/lib/utils";

interface BudgetListProps {
    budgets: Budget[];
    expenses: Expense[];
    onBudgetDeleted: (budgetId: string) => void;
    onBudgetUpdated: (budgetId: string, budget: BudgetFormData) => void;
}

export function BudgetList({ budgets, expenses, onBudgetDeleted, onBudgetUpdated }: BudgetListProps) {
    const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
    const [budgetToEdit, setBudgetToEdit] = useState<Budget | null>(null);

    const calculatedBudgets = useMemo(() => {
        return budgets.map((budget) => {
            const range = getPeriodDateRange(budget.period);
            const spent = getBudgetSpent(budget, expenses);

            const remaining = budget.amount - spent;
            const progress = Math.min((spent / budget.amount) * 100, 100); // Fix 7: Cap at 100%
            const isOverspent = spent > budget.amount;

            // Pacing logic
            const today = startOfDay(new Date());
            const totalDays = differenceInCalendarDays(range.end, range.start) + 1;
            const daysElapsed = differenceInCalendarDays(today, range.start) + 1;
            const periodElapsed = Math.min(daysElapsed / totalDays, 1); // Clamp to 1
            const spentRatio = spent / budget.amount;
            const pacingAlert = spentRatio > periodElapsed && spent < budget.amount;

            return { ...budget, spent, remaining, progress, isOverspent, pacingAlert, spentRatio, periodElapsed };
        });
    }, [budgets, expenses]);

    if (calculatedBudgets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center">
                <h3 className="text-xl font-semibold tracking-tight">No budgets yet</h3>
                <p className="text-sm text-muted-foreground mt-2">Create a budget to start tracking your spending.</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {calculatedBudgets.map((budget) => (
                    <Card key={budget.id}>
                        <CardHeader>
                            <CardTitle>{budget.name}</CardTitle>
                            <CardDescription>{budget.category} - {budget.period}</CardDescription>
                            {budget.isOverspent && (
                                <div className="mt-2 p-2 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-sm font-medium flex items-center gap-2">
                                    <span>🚨</span>
                                    <span>
                                        Over budget by ${(budget.spent - budget.amount).toFixed(2)}!
                                    </span>
                                </div>
                            )}
                            {budget.pacingAlert && (
                                <div className="mt-2 p-2 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-sm font-medium flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>
                                        You are pacing to overspend this {budget.period.toLowerCase()}!<br />
                                        <span className="font-normal">{(budget.spentRatio * 100).toFixed(0)}% spent, {(budget.periodElapsed * 100).toFixed(0)}% of period elapsed.</span>
                                    </span>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Spent</span>
                                <span className={cn(budget.isOverspent && "text-red-600 dark:text-red-400 font-semibold")}>${budget.spent.toFixed(2)}</span>
                            </div>
                            <Progress
                                value={budget.progress}
                                className={cn(budget.isOverspent && "[&>div]:bg-red-600")}
                            />
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Remaining</span>
                                <span className={cn(
                                    budget.remaining < 0 && "text-red-600 dark:text-red-400 font-semibold"
                                )}>${budget.remaining.toFixed(2)}</span>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBudgetToEdit(budget)}
                            >
                                Edit
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setBudgetToDelete(budget)}
                            >
                                Delete
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <AlertDialog open={budgetToDelete !== null} onOpenChange={(open) => !open && setBudgetToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to delete this budget?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the "{budgetToDelete?.name}" budget and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (budgetToDelete) {
                                    onBudgetDeleted(budgetToDelete.id);
                                    setBudgetToDelete(null);
                                }
                            }}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Delete Budget
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={budgetToEdit !== null} onOpenChange={(open) => !open && setBudgetToEdit(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Budget</DialogTitle>
                    </DialogHeader>
                    {budgetToEdit && (
                        <BudgetForm
                            initialData={budgetToEdit}
                            onSubmit={(data) => {
                                onBudgetUpdated(budgetToEdit.id, data);
                                setBudgetToEdit(null);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
} 