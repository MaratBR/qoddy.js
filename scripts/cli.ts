// Qoddy command line: `pnpm qoddy <command>` (runs under Node's type stripping).
// Uses the same database as the server: DATABASE_PATH, default `qoddy.db`.

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { db, Invalid } from '../src/lib/server/db.ts';
import { createUser, setPassword, setRole } from '../src/lib/server/accounts.ts';
import {
	createCollection,
	DEFAULT_SLUG,
	findCollection,
	importCsv,
	listCollections
} from '../src/lib/server/collections.ts';
import { getSettings, setSetting } from '../src/lib/server/settings.ts';

const USAGE = `Usage: pnpm qoddy <command>

  create-user <email> <name> [--admin]   password read from stdin
  set-password <email>                   password read from stdin; signs out every device
  set-role <email> <admin|user>
  collections                            list public collections
  add-collection <slug> <name>
  import <file.csv> [--collection <slug>]  columns: text, author, source, notes, lang, theme, color, font
  settings                               show site settings
  settings set <key> <value>             site_name, allow_sign_up, default_theme, daily`;

async function stdinPassword(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks)
		.toString('utf8')
		.replace(/\r?\n$/, '');
}

async function main(argv: string[]): Promise<void> {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			admin: { type: 'boolean' },
			collection: { type: 'string' },
			help: { type: 'boolean' }
		}
	});
	const [command, ...args] = positionals;
	const need = (count: number) => {
		if (args.length !== count) throw new Invalid(USAGE);
	};
	switch (command) {
		case 'create-user': {
			need(2);
			const user = await createUser(db(), {
				email: args[0],
				name: args[1],
				password: await stdinPassword(),
				role: values.admin ? 'admin' : 'user'
			});
			console.log(`created ${user.role} ${user.email}`);
			break;
		}
		case 'set-password':
			need(1);
			await setPassword(db(), args[0], await stdinPassword());
			console.log('password changed');
			break;
		case 'set-role':
			need(2);
			if (args[1] !== 'admin' && args[1] !== 'user') throw new Invalid('Role is admin or user.');
			console.log(`${setRole(db(), args[0], args[1]).email} is now ${args[1]}`);
			break;
		case 'collections':
			for (const c of listCollections(db())) console.log(`${c.slug}\t${c.count}\t${c.name}`);
			break;
		case 'add-collection':
			need(2);
			console.log(`created /c/${createCollection(db(), { slug: args[0], name: args[1] }).slug}`);
			break;
		case 'import': {
			need(1);
			const slug = values.collection ?? DEFAULT_SLUG;
			const collection = findCollection(db(), slug);
			if (!collection) throw new Invalid(`No collection ${slug}.`);
			const added = importCsv(db(), collection.id, readFileSync(args[0], 'utf8'));
			console.log(`imported ${added} thoughts into ${slug}`);
			break;
		}
		case 'settings':
			if (args[0] === 'set') {
				if (args.length !== 3) throw new Invalid(USAGE);
				setSetting(db(), args[1], args[2]);
			} else need(0);
			for (const [key, value] of Object.entries(getSettings(db()))) {
				if (key !== 'rev') console.log(`${key} = ${value}`);
			}
			break;
		default:
			console.log(USAGE);
			if (!values.help && command !== undefined) process.exitCode = 2;
	}
}

main(process.argv.slice(2)).catch((error) => {
	console.error(error instanceof Invalid ? error.message : error);
	process.exitCode = 1;
});
