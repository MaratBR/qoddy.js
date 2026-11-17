import { describe, expect, it } from 'vitest';
import families from './google-fonts.json' with { type: 'json' };
import { FONT_PICKS } from './font-picks.ts';

describe('FONT_PICKS', () => {
	const picks: string[] = FONT_PICKS.flatMap((group) => group.families);

	it('names only families the list has (refreshing it may drop one)', () => {
		expect(picks.filter((family) => !families.includes(family))).toEqual([]);
	});

	it('names each family once', () => {
		expect(new Set(picks).size).toBe(picks.length);
	});
});
