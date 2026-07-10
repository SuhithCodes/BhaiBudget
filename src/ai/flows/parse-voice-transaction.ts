'use server';

/**
 * @fileOverview Voice transaction AI agent using Groq Whisper + Llama.
 * 
 * 1. Whisper transcribes audio to text
 * 2. Llama parses the transcript into one or more structured expenses/incomes
 */

import { headers } from 'next/headers';
import { groq, TEXT_MODEL, DEFAULT_SETTINGS } from '@/ai/groq';
import { withRetry } from '@/ai/utils/retry';
import { isValidIsoDate } from '@/ai/utils/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from '@/lib/constants';

// Whisper accepts files up to 25 MB; base64 inflates by ~4/3.
const MAX_AUDIO_BASE64_CHARS = 34_000_000;

export interface ParsedTransaction {
    type: 'expense' | 'income';
    expense?: {
        vendorName: string;
        totalAmount: number;
        category: string;
        date: string;
        time?: string;
    };
    income?: {
        sourceName: string;
        amount: number;
        date: string;
        note?: string;
    };
}

export interface VoiceTransactionResult {
    transcript: string;
    transactions: ParsedTransaction[];
}

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const file = new File([audioBuffer], 'audio.webm', { type: mimeType });

    const transcription = await withRetry(() =>
        groq.audio.transcriptions.create({
            file: file,
            model: 'whisper-large-v3-turbo',
            language: 'en',
        }),
    );

    return transcription.text;
}

export async function parseTranscript(transcript: string, todayLocal?: string): Promise<ParsedTransaction[]> {
    // Prefer the caller's local calendar date — "today" for a US-evening user
    // is not the server's UTC "today". Fall back to server UTC.
    const today = isValidIsoDate(todayLocal) ? todayLocal : new Date().toISOString().split('T')[0];

    const prompt = `You are a financial transaction parser. Given a spoken description, extract ALL financial transactions mentioned.

Today's date is: ${today}

The user said: "${transcript}"

IMPORTANT RULES:
1. If the text does NOT contain any clear financial transaction (no mention of spending, paying, receiving, earning money, or specific dollar amounts), return: { "transactions": [] }
2. Do NOT guess or make up amounts. If no amount is mentioned, do NOT include that transaction.
3. Do NOT return transactions with amount 0 or placeholder values.
4. There may be MULTIPLE transactions in one statement. Extract ALL of them.
5. Convert spoken/shorthand amounts to numbers: "twenty bucks" = 20, "a hundred" = 100, "1.5k" = 1500, "three grand" = 3000.

For each EXPENSE, extract:
- vendorName: The store, business, or person paid
- totalAmount: The dollar amount (must be > 0)
- category: MUST be one of: ${JSON.stringify(EXPENSE_CATEGORIES)}
- date: YYYY-MM-DD. "today" = ${today}. "yesterday" = calculate. No date mentioned = ${today}.

For each INCOME, extract:
- sourceName: MUST be one of: ${JSON.stringify(INCOME_SOURCES)}
- amount: The dollar amount (must be > 0)
- date: YYYY-MM-DD, same rules as above
- note: Any additional details

Return ONLY valid JSON:
{
  "transactions": [
    { "type": "expense", "expense": { "vendorName": "...", "totalAmount": 45.00, "category": "Food", "date": "${today}" } },
    { "type": "income", "income": { "sourceName": "Salary", "amount": 3000, "date": "${today}", "note": "..." } }
  ]
}

If nothing looks like a financial transaction, return: { "transactions": [] }`;

    const completion = await withRetry(() =>
        groq.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a JSON-only financial transaction parser. Always respond with valid JSON, no explanation or markdown.' },
                { role: 'user', content: prompt },
            ],
            model: TEXT_MODEL,
            temperature: 0.2,
            max_tokens: DEFAULT_SETTINGS.max_tokens,
            top_p: DEFAULT_SETTINGS.top_p,
            response_format: { type: 'json_object' },
        }),
    );

    const responseText = completion.choices[0]?.message?.content || '';

    try {
        // Try direct parse first (should work with json_object format)
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            // Fallback: extract JSON from markdown code blocks
            const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                parsed = JSON.parse(codeBlockMatch[1].trim());
            } else {
                // Last resort: find the last complete JSON object (not greedy)
                const allJsons = [...responseText.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)];
                if (allJsons.length > 0) {
                    // Try each match, starting from the last (most likely the final answer)
                    for (let i = allJsons.length - 1; i >= 0; i--) {
                        try {
                            const candidate = JSON.parse(allJsons[i][0]);
                            if (candidate.transactions) {
                                parsed = candidate;
                                break;
                            }
                        } catch { continue; }
                    }
                }
            }
        }

        if (!parsed) throw new Error('No valid JSON found in response');
        const result = parsed;
        const transactions: ParsedTransaction[] = result.transactions || [];

        // Validate and filter out invalid transactions
        const valid = transactions.filter((t: ParsedTransaction) => {
            if (t.type === 'expense' && t.expense) {
                if (!t.expense.vendorName || !t.expense.totalAmount || t.expense.totalAmount <= 0) return false;
                if (!(EXPENSE_CATEGORIES as readonly string[]).includes(t.expense.category)) {
                    t.expense.category = 'Miscellaneous';
                }
                if (!isValidIsoDate(t.expense.date)) t.expense.date = today;
                return true;
            }
            if (t.type === 'income' && t.income) {
                if (!t.income.sourceName || !t.income.amount || t.income.amount <= 0) return false;
                if (!(INCOME_SOURCES as readonly string[]).includes(t.income.sourceName)) {
                    t.income.sourceName = 'Other';
                }
                if (!isValidIsoDate(t.income.date)) t.income.date = today;
                return true;
            }
            return false;
        });

        return valid;
    } catch (error) {
        console.error('Failed to parse voice transaction:', responseText, error);
        // Throw instead of returning [] so the UI can distinguish "AI failed,
        // try again" from the genuine "no transaction detected" answer.
        throw new Error('AI processing failed while parsing your voice input. Please try again.');
    }
}

export async function processVoiceTransaction(
    audioBase64: string,
    mimeType: string,
    todayLocal?: string,
): Promise<VoiceTransactionResult> {
    if (audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
        throw new Error('Recording is too large. Please keep it under a minute.');
    }

    const requestHeaders = await headers();
    const clientKey = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`voice:${clientKey}`, { limit: 20, windowMs: 60 * 60 * 1000 })) {
        throw new Error('Too many voice requests. Please try again later.');
    }

    const transcript = await transcribeAudio(audioBase64, mimeType);

    if (!transcript || transcript.trim().length === 0) {
        throw new Error('Could not hear anything. Please try again.');
    }

    const transactions = await parseTranscript(transcript, todayLocal);
    return { transcript, transactions };
}
