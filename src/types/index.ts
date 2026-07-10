import { z } from 'zod';
import { type ExtractReceiptDataOutput } from '@/ai/flows/extract-receipt-data';

export const lineItemSchema = z.object({
  name: z.string().min(1, 'Item name is required.'),
  amount: z.number().min(0, 'Amount cannot be negative.'),
});

export const expenseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  vendorName: z.string().min(1, 'Vendor name is required.'),
  date: z.string().min(1, 'Date is required.'),
  totalAmount: z.number().min(0.01, 'Total must be greater than 0.'),
  category: z.string().min(1, 'Category is required.'),
  lineItems: z.array(lineItemSchema).optional(),
  taxes: z.number().optional(),
  currency: z.string().optional(),
  paymentMethod: z.string().optional(),
  subtotal: z.number().optional(),
  time: z.string().optional(),
  confidence: z.number().optional(),
});

// For forms, we don't have id or userId yet
export const expenseFormSchema = expenseSchema.omit({ id: true, userId: true });

export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseFormData = z.infer<typeof expenseFormSchema>;


export type ProcessedReceiptData = Omit<ExtractReceiptDataOutput, 'vendorName' | 'totalAmount' | 'date' | 'category'> & {
  vendorName: string;
  totalAmount: number;
  date: string;
  category: string;
  confidence: number;
};

export const budgetSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1, 'Budget name is required.'),
  category: z.string().min(1, 'Category is required.'),
  amount: z.number().min(0.01, 'Amount must be greater than 0.'),
  period: z.enum(['Weekly', 'Monthly', 'Yearly']),
  // Alert dedup state: period-start key (YYYY-MM-DD) of the last period each
  // alert tier fired in. See src/lib/check-budget-alerts.ts.
  alertedAt: z
    .object({
      warning: z.string().optional(),
      exceeded: z.string().optional(),
    })
    .optional(),
});

export const budgetFormSchema = budgetSchema.omit({ id: true, userId: true, alertedAt: true });

export type Budget = z.infer<typeof budgetSchema>;
export type BudgetFormData = z.infer<typeof budgetFormSchema>;

export const savingsGoalSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1, 'Goal name is required.'),
  targetAmount: z.number().min(0.01, 'Target amount must be greater than 0.'),
  currentAmount: z.number().min(0, 'Current amount cannot be negative.'),
  deadline: z.string().optional(),
});

export const savingsGoalFormSchema = savingsGoalSchema.omit({ id: true, userId: true });

export type SavingsGoal = z.infer<typeof savingsGoalSchema>;
export type SavingsGoalFormData = z.infer<typeof savingsGoalFormSchema>;

// Income types
export const incomeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sourceName: z.string().min(1, 'Source name is required.'),
  date: z.string().min(1, 'Date is required.'),
  amount: z.number().min(0.01, 'Amount must be greater than 0.'),
  currency: z.string().optional(),
  note: z.string().optional(),
});

export const incomeFormSchema = incomeSchema.omit({ id: true, userId: true });

export type Income = z.infer<typeof incomeSchema>;
export type IncomeFormData = z.infer<typeof incomeFormSchema>;
