// Your thoughts as Markdown, one file each, zipped on the device. Each file
// starts with YAML front matter (every field the thought has), then the text,
// then its notes. Thoughts the account has go in `synced/`; those only on this
// device so far go in `this-device/`.

import { zip, type ZipFile } from './zip.ts';
import type { ThoughtFields } from '../thought.ts';

export interface ExportedThought extends ThoughtFields {
	id: string;
	created: number;
	updatedAt: number;
	from: string | null;
}

/** A JSON string is a valid YAML double-quoted scalar. */
const yaml = (value: string) => JSON.stringify(value);

export function thoughtMarkdown(thought: ExportedThought): string {
	const lines = ['---', `id: ${yaml(thought.id)}`];
	for (const field of ['author', 'source', 'lang', 'theme', 'color', 'font'] as const) {
		const value = thought[field];
		if (value) lines.push(`${field}: ${yaml(value)}`);
	}
	lines.push(`created: ${yaml(new Date(thought.created).toISOString())}`);
	lines.push(`updated: ${yaml(new Date(thought.updatedAt).toISOString())}`);
	if (thought.from) lines.push(`kept_from: ${yaml(thought.from)}`);
	lines.push('---', '', thought.text, '');
	if (thought.notes) lines.push('---', '', thought.notes, '');
	return lines.join('\n');
}

/** A file name from the thought's first words, in any script; the id keeps it unique. */
export function fileName(thought: ExportedThought): string {
	const words = thought.text
		.normalize('NFC')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
		.split(' ')
		.slice(0, 6)
		.join('-')
		.slice(0, 60)
		.toLowerCase();
	return `${words ? `${words}-` : ''}${thought.id}.md`;
}

export function exportArchive(
	thoughts: { thought: ExportedThought; synced: boolean }[],
	date = new Date()
): Blob {
	const files: ZipFile[] = thoughts.map(({ thought, synced }) => ({
		path: `${synced ? 'synced' : 'this-device'}/${fileName(thought)}`,
		text: thoughtMarkdown(thought)
	}));
	return zip(files, date);
}
