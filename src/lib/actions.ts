'use server';

import { headers } from 'next/headers';
import { extractReceiptData } from '@/ai/flows/extract-receipt-data';
import { categorizeExpense } from '@/ai/flows/categorize-expenses';
import { checkRateLimit } from '@/lib/rate-limit';
import { type ProcessedReceiptData } from '@/types';

// ~5 MB of image data once base64 overhead (~4/3) is accounted for.
const MAX_RECEIPT_DATA_URI_CHARS = 7_000_000;

export async function processReceipt(
  dataURI: string
): Promise<ProcessedReceiptData | { error: string }> {
  if (!dataURI) {
    return { error: 'No receipt image provided.' };
  }

  if (dataURI.length > MAX_RECEIPT_DATA_URI_CHARS) {
    return { error: 'Receipt image is too large. Please use an image under 5 MB.' };
  }

  const requestHeaders = await headers();
  const clientKey = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(`receipt:${clientKey}`, { limit: 30, windowMs: 60 * 60 * 1000 })) {
    return { error: 'Too many receipt scans. Please try again later.' };
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
      description: `${extractedData.vendorName} ${extractedData.lineItems?.map((item) => item.name).join(', ') || ''}`.trim(),
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
