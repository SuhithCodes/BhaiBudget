/** Strict YYYY-MM-DD check for model-extracted dates. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns true only for a real calendar date in YYYY-MM-DD format.
 * Model output like "01/15/26" or "N/A" must be rejected — expenses are
 * filtered by lexicographic date comparison, so a malformed date silently
 * disappears from every report.
 */
export function isValidIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
}
