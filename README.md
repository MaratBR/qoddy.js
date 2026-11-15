# Qoddy

A thought for each day, set quietly on the page, and a place to keep your own. SvelteKit 3 (front end and back end), SQLite through `node:sqlite`. Offline first: the app works without a network and without an account, and the server is there to sync.

## Run

Needs Node 24 or later and pnpm.

```sh
pnpm install
echo 'a long password' | pnpm qoddy create-user you@example.com "Your Name" --admin
pnpm dev
```

For a ready-made test database:

```sh
pnpm test-db                             # qoddy-test.db: fixtures plus two users
DATABASE_PATH=qoddy-test.db pnpm dev     # admin@qoddy.test / qoddy-admin, reader@qoddy.test / qoddy-reader
```

Other scripts: `pnpm check` (types, including the service worker), `pnpm test`, `pnpm build`, `pnpm start` (runs `build/`), `pnpm format`.

The service worker only runs in a production build. To try offline behavior, run `pnpm build && pnpm start`, open the site once, then go offline.

## Reading

The home page is today's thought from the **default** collection, with its author and source. When a thought has notes, **About this thought** unfolds them. Below it, **Previous day** and a fixed run of day ticks lead back through the last week (as far as the first tick), and the arrow keys and swipes do the same. Future days stay hidden. The day is the reader's local date. Rotation is `thoughts[dayNumber % count]` in collection order, so every reader sees the same thought on the same day.

**Menu** lists the collections (each at `/c/<slug>`, plus `/c/<slug>/all`), **Your thoughts**, the theme picker and the account. **Write** opens the editor for a thought of your own.

## Thoughts

A thought is its text plus optional fields:

- **author** and **source**: leave both empty for your own thought.
- **notes**: an explanation in simple Markdown (paragraphs, `**bold**`, `*italic*`, `` `code` ``, links, lists, `>` quotes, `#` headings, `---`). The renderer escapes everything first and allows only `http(s)` and `mailto` links, so notes can never carry HTML.
- **lang**: sets the text's language and direction, which drives quotation marks, CJK sizing and right-to-left layout.
- **theme**, **color**, **font**: override the reader's theme on that thought's page. `color` tints the page and `font` is any Google Fonts family, loaded for that thought only.

## Collections

- **Public collections** have no owner. Admins create and edit them in the dashboard or with the CLI, and everyone reads them. The `default` collection feeds the home page. It cannot be deleted or renamed away from the home page.
- **Your thoughts** is one personal collection per reader. Anyone can write thoughts without an account; they stay on the device. **Keep** under a public thought copies it into your thoughts. Signing in uploads the device's thoughts to the account and merges them with what is already there, and every signed-in device then syncs.
- **Thought of the day off:** turning `daily` off makes the home page show the reader's own thoughts instead of the default collection.

### Locking your thoughts

On **Account → Lock**, a signed-in reader can set a password for their thoughts. It is separate from the account password.

- **How it is encrypted:** each thought is encrypted in the browser with AES-GCM-256 before it leaves the device. The key comes from the password via PBKDF2-SHA256 with 600,000 iterations and a random salt. Each item is bound to its id, so the server cannot swap ciphertexts between items.
- **What the server stores:** the salt, a check value and the ciphertext. It never sees the password or the key.
- **On a device:** the derived key is kept as a non-extractable `CryptoKey` in IndexedDB until **Lock this device now** or sign-out.
- **Changing or removing the password:** this re-encrypts everything and sends it as one atomic change. If another device changed the lock meanwhile, the server refuses the whole change and the device starts over from the new lock.
- **Forgotten password:** there is no recovery, and the locked thoughts are lost. The account itself can still be used.

## Sync

The client keeps everything in IndexedDB (`src/lib/client/library.svelte.ts`) and pages never fetch. It syncs through one endpoint, `POST /api/sync`, when it starts, when it comes back online, when the tab becomes visible, every five minutes, and after each change.

- **Public data** (settings, collections, thoughts) is pulled incrementally. Every write takes a number from a global revision counter, deletes leave tombstones, and the client sends the highest revision it has seen.
- **Personal thoughts** are opaque items to the server: plain JSON or ciphertext, plus the id of the key that sealed them. The newest `updatedAt` wins. The server rejects an item sealed with an outdated key, and the client then re-seals it and sends it again.

## Offline (PWA)

The site installs as an app (`/manifest.webmanifest` is built from the site settings; icons are in `static/`). The service worker (`src/service-worker/index.ts`):

- **Pages:** serves the same client-rendered shell for every app page.
- **Code:** keeps app code as it is fetched. After the first visit it fetches every reading-app route's code, so everything works offline from then on.
- **Fonts:** precaches the basic Latin subset of the bundled theme fonts. Other scripts' subsets, and Google Fonts chosen by individual thoughts, are kept once used.
- **Online only:** `/api` and `/admin` always go to the network.

When a new version is deployed, the worker replaces the old cache, and open tabs say a new version is ready and offer a reload.

## Admin dashboard

`/admin` is for admins only; others get a 404. Every page is rendered on the server with `csr = false` and ships no JavaScript. Admin code is never part of the reading app's bundle or its offline cache.

- **Collections:** create, rename, change the address of, or delete a collection. Deleting removes its thoughts from every device on the next sync.
- **Thoughts:** search, edit or add thoughts, preview the notes, and move a thought between collections. A moved thought goes last in its new collection's rotation.
- **Import:** load a collection from CSV. Columns are `text, author, source, notes, lang, theme, color, font`, and only `text` is required. The import adds every row, or none if any row is invalid.
- **Settings:** `site_name`, `default_theme`, `daily` (thought of the day on the home page) and `allow_sign_up`.

## CLI

```sh
pnpm qoddy create-user <email> <name> [--admin]      # password from stdin
pnpm qoddy set-password <email>                      # password from stdin; signs out every device
pnpm qoddy set-role <email> <admin|user>
pnpm qoddy collections
pnpm qoddy add-collection <slug> <name>
pnpm qoddy import <file.csv> [--collection <slug>]   # default collection unless given
pnpm qoddy settings
pnpm qoddy settings set <key> <value>                # site_name, allow_sign_up, default_theme, daily
```

The CLI uses the same `DATABASE_PATH` as the server.

## Languages

The reading app speaks English and Russian. Readers pick a language in **Menu** or on **Account**.

- **Signed in:** the choice is saved to the account and follows the reader to every device. A new account starts in the language the app is showing, which is the browser's language unless the reader picked one.
- **Signed out:** the choice stays on the device. Without one, the app uses the first of the browser's languages it speaks, else English.
- **Server messages:** the server answers in English. Failures a reader can act on, such as a wrong password, also carry a `code`, and the app shows them in the reader's language. The admin dashboard and the CLI are English only.

To add a language:

1. List it in `LOCALES` in `src/lib/locales.ts`.
2. Add its catalog under `src/lib/client/locales/`, typed `Messages`, and register it in `CATALOGS` in `src/lib/client/i18n.svelte.ts`. `pnpm check` fails while a key is missing.

## Themes

Readers pick a theme in **Menu**. A signed-in reader's choice syncs to their account. Otherwise it stays on the device, and it falls back to the site's `default_theme`. Themes with light and dark variants also offer System, Light and Dark.

| Theme   | Character                                       |
| ------- | ----------------------------------------------- |
| Morning | Alegreya on cool sage paper; light and dark     |
| Vesper  | Bodoni Moda, italic, on deep plum; dark only    |
| Field   | Bricolage Grotesque on sunlit straw; light only |

To add a theme:

1. Add its tokens to `src/lib/styles/themes.css`. Every theme sets the same tokens.
2. Add its id, name and browser color to `THEMES` in `src/lib/themes.ts`.

## Configuration

| Variable          | Default           | Notes                                                                                                                                                                                 |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_PATH`   | `qoddy.db`        | Created and migrated on startup. Migrations are append-only (`src/lib/server/db.ts`).                                                                                                 |
| `HOST`, `PORT`    | `0.0.0.0`, `3000` | adapter-node.                                                                                                                                                                         |
| `ORIGIN`          |                   | The public URL, such as `https://qoddy.example`. Needed behind a proxy, or form posts and API writes fail the same-origin check. Alternatively use `PROTOCOL_HEADER` / `HOST_HEADER`. |
| `BODY_SIZE_LIMIT` | `512K`            | Raise it (for example `4M`) if readers keep thousands of thoughts: setting or changing a lock sends them all in one request.                                                          |

## Deploy

```sh
pnpm build
DATABASE_PATH=/var/lib/qoddy/qoddy.db ORIGIN=https://qoddy.example pnpm start
```

- **What to deploy:** `build/`, `package.json` and production `node_modules` (`pnpm install --prod`).
- **Hosting:** serve it behind HTTPS. Service workers and Secure cookies require HTTPS everywhere except localhost.
- **Backups:** back up the SQLite file, using `sqlite3 qoddy.db ".backup backup.db"` while the server is running.

## Security

- **Sessions:** a random 256-bit token in a `session` cookie (HttpOnly, SameSite=Lax, and Secure except on plain-HTTP localhost).
  - The database stores only its SHA-256, so a leaked database does not leak sessions.
  - Sessions last 30 days and renew when used in their second half.
  - Signing out deletes the session server-side. Changing a password ends every session.
- **CSRF:** SvelteKit rejects cross-origin form posts. `/api` writes must be JSON from the same origin, otherwise they get a 403.
- **Passwords:** scrypt (N=2^15) with a random salt per user. Unknown emails still run a hash check, so a failed sign-in takes about the same time either way.
- **Personal thoughts:** the server stores them as given and never interprets them. Locked collections are end-to-end encrypted (see above).
- **Headers:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.

## Compared with the Rust version

Changed to fit "a thought of the day":

- **Dropped:** user-submitted public quotes and their two settings (`allow_user_quotes`, `allow_public_user_quotes`). Public collections are curated by admins, and readers write into their own collection.
- **Replaced:** Saved and Recently viewed are replaced by **Keep** into your thoughts.
- **Dropped:** language detection. Set `lang` explicitly.
- **Dropped:** the `pwa` setting. Offline support is the core of the app, not an option.

Not built yet:

- rate limiting of sign-in and sign-up
- password reset (use `pnpm qoddy set-password`)
- user management in the dashboard (use the CLI)
