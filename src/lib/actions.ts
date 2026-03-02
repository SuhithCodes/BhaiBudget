'use server';

import { extractReceiptData } from '@/ai/flows/extract-receipt-data';
import { categorizeExpense } from '@/ai/flows/categorize-expenses';
import { type ProcessedReceiptData } from '@/types';

export async function processReceipt(
  dataURI: string
): Promise<ProcessedReceiptData | { error: string }> {
  if (!dataURI) {
    return { error: 'No receipt image provided.' };
  }

  try {
    const extractedData = await extractReceiptData({ photoDataUri: dataURI });

    if (!extractedData.isReceipt) {
      return { error: 'The uploaded image does not appear to be a receipt. Please try another image.' };
    }

    if (!extractedData.vendorName || !extractedData.totalAmount || !extractedData.date) {
      return { error: 'Failed to extract essential data from the receipt. Please try a clearer image.' };
    }

    const categorizationInput = {
      description: `${extractedData.vendorName} ${extractedData.lineItems?.join(', ') || ''}`.trim(),
      vendor: extractedData.vendorName,
      amount: extractedData.totalAmount,
      date: extractedData.date,
    };

    const categorization = await categorizeExpense(categorizationInput);

    return {
      ...extractedData,
      vendorName: extractedData.vendorName,
      totalAmount: extractedData.totalAmount,
      date: extractedData.date,
      category: categorization.category,
      confidence: categorization.confidence,
    };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return { error: `An unexpected error occurred while processing the receipt. ${errorMessage}` };
  }
}
