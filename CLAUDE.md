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

## Commands

```sh
pnpm check && pnpm test        # before committing
pnpm test-db                   # fixtures + admin@qoddy.test / qoddy-admin
pnpm build && pnpm start       # the service worker only exists in a build
```

`node:sqlite` prints an ExperimentalWarning; the scripts silence it with `--disable-warning=ExperimentalWarning`.
