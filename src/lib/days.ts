// Calendar days as `YYYY-MM-DD` strings in the reader's own time zone, and the
// daily rotation over a collection.

const DAY_MS = 86_400_000;

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** The reader's local calendar date. */
export function today(now = new Date()): string {
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Days since 1970-01-01 for a calendar date (time zone free). */
export function dayNumber(date: string): number {
	const [year, month, day] = date.split('-').map(Number);
	return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function addDays(date: string, days: number): string {
	const moved = new Date((dayNumber(date) + days) * DAY_MS);
	return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

/**
 * The item for `date`: each day shows the next one in order, wrapping around.
 * `items` must already be in the collection's order. `since` gives the date an
 * item joined (`''`: always there); a day picks only from items there by then,
 * so adding one never changes an earlier day.
 */
export function ofTheDay<T>(
	items: readonly T[],
	date: string,
	since: (item: T) => string = () => ''
): T | undefined {
	const there = items.filter((item) => since(item) <= date);
	const n = there.length;
	if (n === 0) return undefined;
	return there[((dayNumber(date) % n) + n) % n];
}

/** 1 for 1 January. */
export function dayOfYear(date: string): number {
	return dayNumber(date) - dayNumber(`${date.slice(0, 4)}-01-01`) + 1;
}

/** Formats a calendar date without letting the time zone shift it. */
export function formatDate(date: string, options: Intl.DateTimeFormatOptions, locale?: string) {
	return new Date(dayNumber(date) * DAY_MS).toLocaleDateString(locale, {
		...options,
		timeZone: 'UTC'
	});
}
