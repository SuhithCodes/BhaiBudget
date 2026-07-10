'use server';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { type Budget, type BudgetFormData } from '@/types';

const budgetsCollection = collection(db, COLLECTIONS.budgets);

// Create a new budget
export async function addBudget(budgetData: BudgetFormData, userId: string): Promise<Budget> {
    const newBudget = {
        ...budgetData,
        userId,
    };
    const docRef = await addDoc(budgetsCollection, newBudget);
    return {
        id: docRef.id,
        ...newBudget,
    };
}

// Get all budgets for a user
export async function getBudgets(userId: string): Promise<Budget[]> {
    const q = query(budgetsCollection, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const budgets: Budget[] = [];
    querySnapshot.forEach((doc) => {
        budgets.push({ id: doc.id, ...doc.data() } as Budget);
    });
    return budgets;
}

// Update an existing budget
export async function updateBudget(budgetId: string, budgetData: Partial<BudgetFormData>): Promise<void> {
    const budgetDoc = doc(db, COLLECTIONS.budgets, budgetId);
    await updateDoc(budgetDoc, budgetData);
}

// Delete a budget
export async function deleteBudget(budgetId: string): Promise<void> {
    const budgetDoc = doc(db, COLLECTIONS.budgets, budgetId);
    await deleteDoc(budgetDoc);
}
