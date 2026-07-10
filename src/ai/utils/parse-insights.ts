export interface InsightItem {
    emoji: string;
    title: string;
    detail: string;
}

/**
 * Parse the report-insights completion. The model is instructed to return
 * `{ "insights": [...] }` (json_object mode forces a top-level object), but
 * we also accept a bare array defensively. Malformed output returns []
 * instead of throwing so a bad completion never fails the whole report.
 */
export function parseInsights(responseText: string): InsightItem[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(responseText.trim());
    } catch {
        return [];
    }

    const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { insights?: unknown })?.insights)
            ? (parsed as { insights: unknown[] }).insights
            : [];

    return items
        .filter(
            (i): i is InsightItem =>
                typeof i === 'object' &&
                i !== null &&
                typeof (i as InsightItem).emoji === 'string' &&
                typeof (i as InsightItem).title === 'string' &&
                typeof (i as InsightItem).detail === 'string',
        )
        .slice(0, 3);
}
