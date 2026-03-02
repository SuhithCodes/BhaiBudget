"use client"

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Budget, type BudgetFormData, budgetFormSchema } from '@/types';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

interface BudgetFormProps {
    onSubmit: (budget: BudgetFormData) => void;
    initialData?: Budget;
}

export function BudgetForm({ onSubmit, initialData }: BudgetFormProps) {
    const form = useForm<BudgetFormData>({
        resolver: zodResolver(budgetFormSchema),
        defaultValues: {
            name: '',
            category: '',
            amount: 0,
            period: 'Monthly',
        },
    });

    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name,
                category: initialData.category,
                amount: initialData.amount,
                period: initialData.period,
            });
        }
    }, [initialData, form]);

    const handleSubmit = (data: BudgetFormData) => {
        onSubmit(data);
        if (!initialData) {
            form.reset(); // Only reset if we're creating a new budget
        }
    };

    return (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="name">Budget Name</Label>
                <Input id="name" {...form.register('name')} placeholder="e.g., Monthly Groceries" />
                {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
            </div>
            <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                    onValueChange={(value) => form.setValue('category', value, { shouldValidate: true })}
                    value={form.watch('category')}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                        {EXPENSE_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                                {category}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {form.formState.errors.category && (
                    <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" type="number" step="0.01" {...form.register('amount', { valueAsNumber: true })} placeholder="100.00" />
                    {form.formState.errors.amount && (
                        <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="period">Period</Label>
                    <Select onValueChange={(value) => form.setValue('period', value as 'Weekly' | 'Monthly' | 'Yearly')} value={form.watch('period')}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Weekly">Weekly</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Yearly">Yearly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialData ? 'Update Budget' : 'Save Budget'}
            </Button>
        </form>
    );
}