// Refreshes the Google Fonts families the font picker offers:
// `pnpm google-fonts` writes src/lib/client/google-fonts.json, most popular
// first. Commit the result; the app loads it with the picker, and the fonts
// themselves come from Google.

import { writeFileSync } from 'node:fs';
import { validFont } from '../src/lib/thought.ts';

type Family = { family: string; popularity: number; fonts: Record<string, unknown> };

const response = await fetch('https://fonts.google.com/metadata/fonts');
if (!response.ok) throw new Error(`Google Fonts responded ${response.status}`);
const { familyMetadataList } = (await response.json()) as { familyMetadataList: Family[] };

const families = familyMetadataList
	// A thought asks for its family's regular face (`fontHref`), so a family
	// needs one; the name must also pass the thought's own check.
	.filter((entry) => '400' in entry.fonts && validFont(entry.family))
	.sort((a, b) => a.popularity - b.popularity)
	.map((entry) => entry.family);

const file = new URL('../src/lib/client/google-fonts.json', import.meta.url);
writeFileSync(file, JSON.stringify(families) + '\n');
console.log(`${families.length} families`);
