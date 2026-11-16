# Qoddy: notes for working on the code

See README.md for what the app does. This file covers conventions that are easy to get wrong.

## SvelteKit 3, not 2

- **Config:** passed to `sveltekit({...})` in `vite.config.ts`. There is no `svelte.config.js`.
- **Imports:** use `#lib/...` (package.json `imports`), not `$lib`. Use `$app/env`, not `$app/environment`. `$app/manifest` replaces `$service-worker`.
- **Responses and navigation:** `Response.json(...)` replaces `json()`. `goto(url, { reset: false })` replaces keepFocus/noScroll, and links use `data-sveltekit-reset="false"`.
- **`resolve()`** from `$app/paths` takes route ids: the home page is `'/(app)'`.
- **Service worker:** `src/service-worker/index.ts` is its own TS project (`src/service-worker/tsconfig.json`), checked by `pnpm check`.

## Architecture rules

- **Reading app (`src/routes/(app)`):** client-rendered (`ssr = false`). Pages read only from `library` (`#lib/client/library.svelte.ts`) and never fetch. All server traffic is `POST /api/sync` and `/api/auth`.
- **Admin (`src/routes/admin`):** `csr = false`, with forms and actions only. Every load and every action calls `requireAdmin(locals)`, because a layout check does not guard actions. Never import admin code from `(app)`: the service worker warms only `(app)` routes, so admin chunks stay out of readers' downloads.
- **Personal thoughts:** opaque to the server (`personal_item.data`). Validation of their content happens on the client (`checkThought`).
- **Database:** every write to synced data must bump `rev` via `nextRev(db)` inside a `transaction`. Deletes are tombstones (`deleted = 1`), never `DELETE`. Migrations in `db.ts` are append-only.
- **Shared code:** `#lib/thought.ts`, `#lib/markdown.ts`, `#lib/days.ts` and `#lib/themes.ts` run on both sides. Keep them free of Node and DOM APIs.

## Live users: do not break them

Qoddy has real users since 2026-11-16 (https://qoddy.mswsi.net). Every change must keep working with what is already out there:

- **Devices hold data we cannot see.** IndexedDB records, `meta.state` and stored keys written by any earlier version must still load. Read old shapes; never assume a field exists (`saved.x ?? default`).
- **Old clients meet the new server.** A tab or installed app can run cached code for a while. `/api/sync` and `/api/auth` changes must be additive: new request fields optional, new response fields ignorable, nothing renamed or removed.
- **The database is migrated in place.** Migrations stay append-only and must succeed on the live data; never rewrite or drop users' rows to make a migration easier.
- **Nothing may lose a reader's thoughts.** Local thoughts leave a device only when the reader asks (delete, sign out, erase). Sync must never drop them as a side effect.

## Commands

```sh
pnpm check && pnpm test        # before committing
pnpm test-db                   # fixtures + admin@qoddy.test / qoddy-admin
pnpm build && pnpm start       # the service worker only exists in a build
```

`node:sqlite` prints an ExperimentalWarning; the scripts silence it with `--disable-warning=ExperimentalWarning`.
