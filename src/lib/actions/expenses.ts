'use server';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { doc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { type ExpenseFormData, type Expense } from '@/types';

// Update an existing expense
export async function updateExpense(expenseId: string, expenseData: Partial<ExpenseFormData>): Promise<void> {
    const expenseDoc = doc(db, COLLECTIONS.expenses, expenseId);
    await updateDoc(expenseDoc, expenseData);
}

// Delete an expense
export async function deleteExpense(expenseId: string): Promise<void> {
    const expenseDoc = doc(db, COLLECTIONS.expenses, expenseId);
    await deleteDoc(expenseDoc);
}

export async function getExpenses(userId: string): Promise<Expense[]> {
    const q = query(collection(db, COLLECTIONS.expenses), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    querySnapshot.forEach((doc) => {
        expenses.push({ id: doc.id, ...doc.data() } as Expense);
    });
    return expenses;
}

// Delete all expenses for a user
export async function deleteAllExpenses(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const q = query(collection(db, COLLECTIONS.expenses), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { success: true };
        }

        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("Error deleting all expenses: ", error);
        return { success: false, error: "Could not delete all expenses." };
    }
}
