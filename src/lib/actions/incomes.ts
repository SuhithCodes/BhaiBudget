'use server';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { doc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { type IncomeFormData } from '@/types';

// Update an existing income
export async function updateIncome(incomeId: string, incomeData: Partial<IncomeFormData>): Promise<void> {
    const incomeDoc = doc(db, COLLECTIONS.incomes, incomeId);
    await updateDoc(incomeDoc, incomeData);
}

// Delete an income
export async function deleteIncome(incomeId: string): Promise<void> {
    const incomeDoc = doc(db, COLLECTIONS.incomes, incomeId);
    await deleteDoc(incomeDoc);
}

export async function deleteAllIncomes(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const q = query(collection(db, COLLECTIONS.incomes), where('userId', '==', userId));
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
        console.error("Error deleting all incomes: ", error);
        return { success: false, error: "Could not delete all incomes." };
    }
}
