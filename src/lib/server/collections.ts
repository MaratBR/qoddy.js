// Public collections and their thoughts. They have no owner: admins edit them,
// everyone reads them. The one the `home` setting names feeds the home page
// and cannot be deleted while it does.
//
// Deleting keeps a tombstone (`deleted = 1`, fields cleared) so the deletion
// reaches offline copies on their next sync.

import { Invalid, nextRev, transaction, type Db } from './db.ts';
import { parseCsvRecords, CsvError } from '../csv.ts';
import { checkThought, isId, newId, type ThoughtFields } from '../thought.ts';

/** Reserved: the reader's personal collection in the app's URLs. */
export const MINE_SLUG = 'mine';

export interface Collection {
	id: number;
	slug: string;
	name: string;
	description: string;
}

export interface Thought extends ThoughtFields {
	id: string;
	/** Rotation order within the collection. */
	seq: number;
	collection_id: number;
}

const THOUGHT_COLUMNS =
	'seq, id, collection_id, text, author, source, notes, lang, theme, color, font';

export function listCollections(db: Db): (Collection & { count: number })[] {
	return db
		.prepare(
			`SELECT c.id, c.slug, c.name, c.description,
				(SELECT count(*) FROM thought t WHERE t.collection_id = c.id AND t.deleted = 0) AS count
			FROM collection c WHERE c.deleted = 0
			ORDER BY c.id IS NOT (SELECT home FROM settings), c.name COLLATE NOCASE`
		)
		.all() as unknown as (Collection & { count: number })[];
}

/** The home page shows this collection's thought of the day. */
export function isHome(db: Db, id: number): boolean {
	return db.prepare('SELECT 1 FROM settings WHERE home = ?').get(id) !== undefined;
}

export function findCollection(db: Db, slug: string): Collection | undefined {
	return db
		.prepare('SELECT id, slug, name, description FROM collection WHERE slug = ? AND deleted = 0')
		.get(slug) as Collection | undefined;
}

function checkCollection(input: { slug: string; name: string; description?: string }) {
	const slug = input.slug.trim().toLowerCase();
	const name = input.name.trim();
	const description = (input.description ?? '').trim();
	if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) {
		throw new Invalid('Use lowercase letters, digits and dashes (up to 40).', 'slug');
	}
	// `/c/mine` is each reader's personal collection.
	if (slug === MINE_SLUG) throw new Invalid('That address is reserved.', 'slug');
	if (!name || name.length > 80) throw new Invalid('Give it a name (up to 80 characters).', 'name');
	if (description.length > 500) throw new Invalid('Keep it under 500 characters.', 'description');
	return { slug, name, description };
}

function slugTaken(db: Db, slug: string, except?: number): boolean {
	const row = db.prepare('SELECT id FROM collection WHERE slug = ?').get(slug) as
		{ id: number } | undefined;
	return row !== undefined && row.id !== except;
}

export function createCollection(
	db: Db,
	input: { slug: string; name: string; description?: string }
): Collection {
	const value = checkCollection(input);
	return transaction(db, () => {
		if (slugTaken(db, value.slug)) throw new Invalid('That address is taken.', 'slug');
		db.prepare('INSERT INTO collection (slug, name, description, rev) VALUES (?, ?, ?, ?)').run(
			value.slug,
			value.name,
			value.description,
			nextRev(db)
		);
		return findCollection(db, value.slug)!;
	});
}

export function updateCollection(
	db: Db,
	id: number,
	input: { slug: string; name: string; description?: string }
): Collection {
	const value = checkCollection(input);
	return transaction(db, () => {
		if (!db.prepare('SELECT 1 FROM collection WHERE id = ? AND deleted = 0').get(id)) {
			throw new Invalid('That collection no longer exists.');
		}
		if (slugTaken(db, value.slug, id)) throw new Invalid('That address is taken.', 'slug');
		db.prepare(
			'UPDATE collection SET slug = ?, name = ?, description = ?, rev = ? WHERE id = ?'
		).run(value.slug, value.name, value.description, nextRev(db), id);
		return findCollection(db, value.slug)!;
	});
}

/** Deletes a collection and its thoughts. The home page's collection stays. */
export function deleteCollection(db: Db, id: number): void {
	transaction(db, () => {
		if (!db.prepare('SELECT 1 FROM collection WHERE id = ? AND deleted = 0').get(id)) return;
		if (isHome(db, id)) {
			throw new Invalid('The home page shows this collection. Choose another in Settings first.');
		}
		const rev = nextRev(db);
		// The tombstone gives up its address so it can be reused.
		db.prepare(
			"UPDATE collection SET deleted = 1, slug = '~' || id, name = '', description = '', rev = ? WHERE id = ?"
		).run(rev, id);
		db.prepare(
			`UPDATE thought SET deleted = 1, text = '', author = NULL, source = NULL, notes = NULL,
				lang = NULL, theme = NULL, color = NULL, font = NULL, rev = ?
			WHERE collection_id = ? AND deleted = 0`
		).run(rev, id);
	});
}

export function findThought(db: Db, id: string): Thought | undefined {
	if (!isId(id)) return undefined;
	return db
		.prepare(`SELECT ${THOUGHT_COLUMNS} FROM thought WHERE id = ? AND deleted = 0`)
		.get(id) as Thought | undefined;
}

function insertThought(db: Db, collectionId: number, value: ThoughtFields): Thought {
	// Ids are random; a collision is astronomically rare, but retry rather than fail.
	for (let attempt = 0; ; attempt++) {
		const id = newId();
		try {
			db.prepare(
				`INSERT INTO thought (id, collection_id, text, author, source, notes, lang, theme, color, font, rev)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).run(
				id,
				collectionId,
				value.text,
				value.author,
				value.source,
				value.notes,
				value.lang,
				value.theme,
				value.color,
				value.font,
				nextRev(db)
			);
			return findThought(db, id)!;
		} catch (error) {
			if (attempt >= 3 || !String(error).includes('UNIQUE')) throw error;
		}
	}
}

function checked(input: Record<string, unknown>): ThoughtFields {
	const result = checkThought(input);
	if (!result.ok) throw new Invalid(result.error, result.field);
	return result.value;
}

function liveCollection(db: Db, id: number): void {
	if (!db.prepare('SELECT 1 FROM collection WHERE id = ? AND deleted = 0').get(id)) {
		throw new Invalid('That collection no longer exists.', 'collection');
	}
}

export function addThought(db: Db, collectionId: number, input: Record<string, unknown>): Thought {
	const value = checked(input);
	return transaction(db, () => {
		liveCollection(db, collectionId);
		return insertThought(db, collectionId, value);
	});
}

/** Edits a thought; moving it to another collection puts it last there. */
export function updateThought(
	db: Db,
	id: string,
	collectionId: number,
	input: Record<string, unknown>
): Thought {
	const value = checked(input);
	return transaction(db, () => {
		const current = findThought(db, id);
		if (!current) throw new Invalid('That thought no longer exists.');
		liveCollection(db, collectionId);
		const moved = current.collection_id !== collectionId;
		db.prepare(
			`UPDATE thought SET collection_id = ?, text = ?, author = ?, source = ?, notes = ?, lang = ?,
				theme = ?, color = ?, font = ?, rev = ?,
				seq = CASE WHEN ? THEN (SELECT max(seq) + 1 FROM thought) ELSE seq END
			WHERE id = ?`
		).run(
			collectionId,
			value.text,
			value.author,
			value.source,
			value.notes,
			value.lang,
			value.theme,
			value.color,
			value.font,
			nextRev(db),
			+moved,
			id
		);
		return findThought(db, id)!;
	});
}

export function deleteThought(db: Db, id: string): void {
	transaction(db, () => {
		db.prepare(
			`UPDATE thought SET deleted = 1, text = '', author = NULL, source = NULL, notes = NULL,
				lang = NULL, theme = NULL, color = NULL, font = NULL, rev = ?
			WHERE id = ? AND deleted = 0`
		).run(nextRev(db), id);
	});
}

export const PER_PAGE = 25;

export interface Listing {
	thoughts: Thought[];
	total: number;
	page: number;
	pages: number;
}

/** A page of a collection's thoughts, newest first, matching `search` in text, author or source. */
export function browseThoughts(
	db: Db,
	collectionId: number,
	options: { search?: string; page?: number } = {}
): Listing {
	const search = options.search?.trim();
	const where = ['collection_id = ?', 'deleted = 0'];
	const params: (string | number)[] = [collectionId];
	if (search) {
		// Taken literally: `%` and `_` are escaped.
		const like = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
		where.push(
			"(text LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\' OR source LIKE ? ESCAPE '\\')"
		);
		params.push(like, like, like);
	}
	const clause = where.join(' AND ');
	const { total } = db
		.prepare(`SELECT count(*) AS total FROM thought WHERE ${clause}`)
		.get(...params) as {
		total: number;
	};
	const pages = Math.max(1, Math.ceil(total / PER_PAGE));
	const page = Math.min(Math.max(1, Math.floor(options.page ?? 1) || 1), pages);
	const thoughts = db
		.prepare(
			`SELECT ${THOUGHT_COLUMNS} FROM thought WHERE ${clause} ORDER BY seq DESC LIMIT ? OFFSET ?`
		)
		.all(...params, PER_PAGE, (page - 1) * PER_PAGE) as unknown as Thought[];
	return { thoughts, total, page, pages };
}

export const CSV_COLUMNS = ['text', 'author', 'source', 'notes', 'lang', 'theme', 'color', 'font'];

/**
 * Adds thoughts from CSV with a header row (see `CSV_COLUMNS`; only `text` is
 * required). All rows are added or none are.
 */
export function importCsv(db: Db, collectionId: number, csv: string): number {
	let rows;
	try {
		rows = parseCsvRecords(csv);
	} catch (error) {
		if (error instanceof CsvError) throw new Invalid(error.message);
		throw error;
	}
	const unknown = Object.keys(rows[0]?.record ?? {}).filter((name) => !CSV_COLUMNS.includes(name));
	if (unknown.length) {
		throw new Invalid(`Unknown column ${unknown.join(', ')}; expected ${CSV_COLUMNS.join(', ')}.`);
	}
	const values = rows.map(({ line, record }) => {
		const result = checkThought(record);
		if (!result.ok) throw new Invalid(`Line ${line}, ${result.field}: ${result.error}`);
		return result.value;
	});
	return transaction(db, () => {
		liveCollection(db, collectionId);
		for (const value of values) insertThought(db, collectionId, value);
		return values.length;
	});
}
