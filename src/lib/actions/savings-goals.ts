'use server';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { type SavingsGoal, type SavingsGoalFormData } from '@/types';

const savingsGoalsCollection = collection(db, COLLECTIONS.savingsGoals);

// Create a new savings goal
export async function addSavingsGoal(goalData: SavingsGoalFormData, userId: string): Promise<SavingsGoal> {
    const newGoal = {
        ...goalData,
        userId,
    };
    const docRef = await addDoc(savingsGoalsCollection, newGoal);
    return {
        id: docRef.id,
        ...newGoal,
    };
}

// Get all savings goals for a user
export async function getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    const q = query(savingsGoalsCollection, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const goals: SavingsGoal[] = [];
    querySnapshot.forEach((doc) => {
        goals.push({ id: doc.id, ...doc.data() } as SavingsGoal);
    });
    return goals;
}

// Update an existing savings goal
export async function updateSavingsGoal(goalId: string, goalData: Partial<SavingsGoalFormData>): Promise<void> {
    const goalDoc = doc(db, COLLECTIONS.savingsGoals, goalId);
    await updateDoc(goalDoc, goalData);
}

// Delete a savings goal
export async function deleteSavingsGoal(goalId: string): Promise<void> {
    const goalDoc = doc(db, COLLECTIONS.savingsGoals, goalId);
    await deleteDoc(goalDoc);
}
