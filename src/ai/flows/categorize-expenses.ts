// src/ai/flows/categorize-expenses.ts
'use server';

/**
 * @fileOverview This file defines a function for automatically categorizing expenses using Groq AI.
 *
 * - categorizeExpense - A function that categorizes an expense based on its description and other information.
 * - CategorizeExpenseInput - The input type for the categorizeExpense function.
 * - CategorizeExpenseOutput - The return type for the categorizeExpense function.
 */

import { groq, TEXT_MODEL, DEFAULT_SETTINGS } from '@/ai/groq';
import { withRetry } from '@/ai/utils/retry';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

export interface CategorizeExpenseInput {
  description: string;
  vendor: string;
  amount: number;
  date: string;
}

export interface CategorizeExpenseOutput {
  category: string;
  confidence: number;
}

export async function categorizeExpense(input: CategorizeExpenseInput): Promise<CategorizeExpenseOutput> {
  const prompt = `You are an expert expense categorizer. Given the following information about an expense, determine the most appropriate category for it.

Description: ${input.description}
Vendor: ${input.vendor}
Amount: ${input.amount}
Date: ${input.date}

You MUST choose one of the following predefined categories:
${JSON.stringify(EXPENSE_CATEGORIES)}

Return the category and confidence in JSON format. The category field should contain the category of the expense. The confidence field should be a number between 0 and 1 representing the confidence level. Only return a valid JSON object, no additional text.

For example:
{
  "category": "Food",
  "confidence": 0.95
}`;

  const chatCompletion = await withRetry(() =>
    groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: TEXT_MODEL,
      // Classification has one right answer — no sampling randomness.
      temperature: 0,
      max_tokens: DEFAULT_SETTINGS.max_tokens,
      top_p: DEFAULT_SETTINGS.top_p,
    }),
  );

  const responseText = chatCompletion.choices[0]?.message?.content || '';

  try {
    // Extract JSON from the response (handle potential markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const result = JSON.parse(jsonMatch[0]) as CategorizeExpenseOutput;
    const validCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(result.category)
      ? result.category
      : 'Miscellaneous';
    return {
      category: validCategory,
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', responseText, error);
    return {
      category: 'Miscellaneous',
      confidence: 0,
    };
  }
}
