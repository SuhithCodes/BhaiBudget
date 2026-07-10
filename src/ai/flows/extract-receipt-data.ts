'use server';

/**
 * @fileOverview A receipt data extraction AI agent using Groq.
 *
 * - extractReceiptData - A function that handles the receipt data extraction process.
 * - ExtractReceiptDataInput - The input type for the extractReceiptData function.
 * - ExtractReceiptDataOutput - The return type for the extractReceiptData function.
 */

import { groq, VISION_MODEL, DEFAULT_SETTINGS } from '@/ai/groq';
import { withRetry } from '@/ai/utils/retry';
import { isValidIsoDate } from '@/ai/utils/validation';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

export interface ExtractReceiptDataInput {
  photoDataUri: string;
}

export interface LineItem {
  name: string;
  quantity?: number;
  amount: number;
}

export interface ExtractReceiptDataOutput {
  isReceipt: boolean;
  vendorName?: string;
  date?: string;
  time?: string;
  totalAmount?: number;
  category?: typeof EXPENSE_CATEGORIES[number];
  taxes?: number;
  paymentMethod?: string;
  subtotal?: number;
  currency?: string;
  lineItems?: LineItem[];
}

export async function extractReceiptData(input: ExtractReceiptDataInput): Promise<ExtractReceiptDataOutput> {
  const prompt = `You are an expert financial assistant specializing in extracting data from receipts.

Your first task is to determine if the provided image is a receipt.
- If the image IS a receipt, set 'isReceipt' to true and extract all the relevant information.
- If the image IS NOT a receipt, set 'isReceipt' to false and do not attempt to extract any other information; return null or empty values for the other fields.

For the expense 'category', you MUST choose one of the following predefined categories:
${JSON.stringify(EXPENSE_CATEGORIES)}

When extracting data from a valid receipt, pay close attention to the format requirements for each field. For the currency, you MUST return a three-letter ISO 4217 currency code (e.g., USD, EUR, JPY). It is critical that you do not use currency symbols like $ or €. Only use the three-letter code.

For each line item, extract the name, quantity (if available), and the total amount for the item. The amount should be the total for that line (e.g., quantity multiplied by the unit price).

IMPORTANT: Include ALL charges and adjustments as line items:
- Positive charges (fees, fares, etc.) should have positive amounts
- Promotions, discounts, or credits should be included as line items with NEGATIVE amounts (e.g., {"name": "Promotion", "amount": -2.50})
- The subtotal should equal the sum of all line items (including negative ones)
- The total should equal: subtotal + taxes

If no tax amount is explicitly listed on the receipt, set the 'taxes' field to 0.

Date rules: receipts may print dates as MM/DD/YYYY (US) or DD/MM/YYYY. If ambiguous, prefer MM/DD/YYYY. Always convert to YYYY-MM-DD. A two-digit year means 20YY. If no date is visible, return null — do not guess.

Output the data in JSON format only. Do not include any surrounding text or markdown code blocks.

Expected JSON structure:
{
  "isReceipt": boolean,
  "vendorName": string | null,
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "totalAmount": number | null,
  "category": string | null,
  "taxes": number | null,
  "paymentMethod": string | null,
  "subtotal": number | null,
  "currency": "USD" | "EUR" | etc | null,
  "lineItems": [{ "name": string, "quantity": number | null, "amount": number }] | null
}`;

  // Validate the data URI shape before spending an inference call on it
  if (!/^data:[^;]+;base64,.+$/.test(input.photoDataUri)) {
    throw new Error('Invalid image data. Please upload the receipt again.');
  }

  const chatCompletion = await withRetry(() =>
    groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: input.photoDataUri,
              },
            },
          ],
        },
      ],
      model: VISION_MODEL,
      // Extraction has one right answer — no sampling randomness.
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
    const result = JSON.parse(jsonMatch[0]);
    
    // Validate and sanitize the result
    const output: ExtractReceiptDataOutput = {
      isReceipt: Boolean(result.isReceipt),
    };

    if (output.isReceipt) {
      if (result.vendorName) output.vendorName = String(result.vendorName);
      // Only accept a strict YYYY-MM-DD date. A malformed date saved to
      // Firestore silently disappears from every report (lexicographic date
      // filtering), so leaving it unset — which the caller surfaces as a
      // "try a clearer image" error — degrades gracefully instead.
      if (isValidIsoDate(result.date)) output.date = result.date;
      if (result.time) output.time = String(result.time);
      if (typeof result.totalAmount === 'number') output.totalAmount = result.totalAmount;
      if (result.category && EXPENSE_CATEGORIES.includes(result.category)) {
        output.category = result.category;
      }
      if (typeof result.taxes === 'number') output.taxes = result.taxes;
      if (result.paymentMethod) output.paymentMethod = String(result.paymentMethod);
      if (typeof result.subtotal === 'number') output.subtotal = result.subtotal;
      if (result.currency) output.currency = String(result.currency);
      if (Array.isArray(result.lineItems)) {
        output.lineItems = result.lineItems.map((item: { name: string; quantity?: number; amount: number }) => ({
          name: String(item.name),
          quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
          amount: typeof item.amount === 'number' ? item.amount : 0,
        }));
      }
    }

    return output;
  } catch (error) {
    console.error('Failed to parse AI response:', responseText, error);
    // Throw instead of returning { isReceipt: false } so the user sees
    // "AI processing failed" rather than the misleading "not a receipt".
    throw new Error('AI processing failed while reading the receipt. Please try again.');
  }
}
