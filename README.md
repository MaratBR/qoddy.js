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

The home page is today's thought from the **home** collection (see `home` under Collections), with its author and source. A thought from a collection carries the collection's name beside the date; your own thoughts carry none. Under the thought, icons keep it, link to it, list the whole collection and, when it has notes, unfold them; in your own thoughts they edit it and show another of yours at random (`?t=<id>`). Below, an arrow and a fixed run of day ticks lead back through the last week (as far as the first tick), and the arrow keys and swipes do the same. Future days stay hidden. The day is the reader's local date. Rotation is `thoughts[dayNumber % count]` in collection order, so every reader sees the same thought on the same day.

On a phone the thought is centered, with even room on both sides.

**Share as image:** under any thought, the image button draws it as a 1080×1350 PNG on the device (in the page's theme, colors and font) and opens the share sheet, or downloads it where the browser cannot share files.

The page fits the window: a thought too long for it is set smaller (down to 55% of its size) rather than scroll.

**Menu** lists the collections (each at `/c/<slug>`, plus `/c/<slug>/all`; empty ones are left out), **Your thoughts**, the three themes, and links to the account and to Appearance. It invites readers to create an account only while the site allows sign-up. **Write** opens the editor for a thought of your own. The editor is set like the thought's page: the text in its reading size, the attribution under it, and notes and style folded away. Ctrl/⌘ + Enter saves. Editing an existing thought, Save and Cancel return to the page you came from.

## Thoughts

A thought is its text plus optional fields:

- **author** and **source**: leave both empty for your own thought.
- **notes**: an explanation in simple Markdown (paragraphs, `**bold**`, `*italic*`, `` `code` ``, links, lists, `>` quotes, `#` headings, `---`). The renderer escapes everything first and allows only `http(s)` and `mailto` links, so notes can never carry HTML. In the reading app, notes are edited as they read (Tiptap, limited to what the renderer knows) and written back as Markdown by `toMarkdown` in `markdown.ts`.
- **lang**: sets the text's language and direction, which drives quotation marks, CJK sizing and right-to-left layout.
- **theme**, **color**, **font**: override the reader's theme on that thought's page. `color` tints the page and `font` is any Google Fonts family, loaded for that thought only.

## Collections

- **Public collections** have no owner. Admins create and edit them in the dashboard or with the CLI, and everyone reads them. An admin can **hide** one (not the home collection): readers' devices get it and its thoughts as deletions, and showing it again brings them back. Empty collections never appear in the reading app's menu. The `home` setting picks the one that feeds the home page (`default` at first). It is kept by id, so its address can change, but it cannot be deleted while it is home.
- **Your thoughts** is one personal collection per reader. Anyone can write thoughts without an account; they stay on the device. **Keep** under a public thought copies it into your thoughts. Signing in uploads the device's thoughts to the account and merges them with what is already there, and every signed-in device then syncs.
- **Reader's choice:** setting `home` to `mine` turns the shared thought of the day off. Each reader's home page then shows one of their own thoughts, with nothing to choose. With a home collection set, **Account → Appearance → Home page** lets each reader show their own thoughts there instead.

### Locking your thoughts

On **Account → Privacy → Thought lock**, a signed-in reader can set a password for their thoughts. It is separate from the account password.

- **How it is encrypted:** each thought is encrypted in the browser with AES-GCM-256 before it leaves the device. The key comes from the password via PBKDF2-SHA256 with 600,000 iterations and a random salt. Each item is bound to its id, so the server cannot swap ciphertexts between items.
- **What the server stores:** the salt, a check value and the ciphertext. It never sees the password or the key.
- **On a device:** the derived key is kept as a non-extractable `CryptoKey` in IndexedDB until **Lock this device now** or sign-out.
- **Changing or removing the password:** this re-encrypts everything and sends it as one atomic change. If another device changed the lock meanwhile, the server refuses the whole change and the device starts over from the new lock.
- **Forgotten password:** there is no recovery, and the locked thoughts are lost. The account itself can still be used.

### Your data

On **Account → Your data**:

- **Export:** downloads your thoughts as a zip of Markdown files, built in the browser (no server involved, works signed out). Each file has YAML front matter (author, source, lang, theme, color, font, created, updated, kept_from), the text, then the notes. Thoughts already in your account are under `synced/`, those only on this device under `this-device/`. Locked thoughts must be unlocked first.
- **Delete account:** asks twice, then deletes the account, its sessions and every synced thought on the server at once (SQLite `secure_delete` overwrites the rows), and the account's thoughts on this device. The last admin cannot delete their account.
- **Stats for nerds** (link at the bottom of **Account**): the app's and the server's build time and commit, when the server started, sync cursors, counts, storage use and whether the browser protects it from eviction.

### App lock

On **Account → Privacy → App lock**, any reader (signed in or not) can lock the app on this device with a **6-digit passcode** (entered on an iPhone-style keypad that covers the screen while it is set) or a **password**.

- **What it does:** the app asks for it whenever it opens, and again after five minutes in the background. Everything the app keeps in IndexedDB (public and personal thoughts, sync state, thought-lock keys) is stored encrypted and decrypted only into memory. Device preferences in localStorage (theme, mode, colors, language, home choice) stay plain.
- **How:** a random AES-GCM-256 data key encrypts every stored value, bound to its store and key. The data key is itself encrypted with a key derived from the passcode (PBKDF2-SHA256, 600,000 iterations). Changing the passcode re-wraps the data key; turning the lock on or off rewrites everything in one transaction, and other open tabs reload.
- **Strength:** a passcode keeps out someone holding the device. Someone who copies the browser's storage can try all million passcodes offline, so a long password is much stronger.
- **Forgotten:** **Forgot it?** on the lock screen erases this device's data (after asking twice). Thoughts in the account come back on signing in; the rest is lost.

## Sync

The client keeps everything in IndexedDB (`src/lib/client/library.svelte.ts`) and pages never fetch. It syncs through one endpoint, `POST /api/sync`, when it starts, when it comes back online, when the tab becomes visible, every five minutes, and after each change.

- **Public data** (settings, collections, thoughts) is pulled incrementally. Every write takes a number from a global revision counter, deletes leave tombstones, and the client sends the highest revision it has seen.
- **Personal thoughts** are opaque items to the server: plain JSON or ciphertext, plus the id of the key that sealed them. The newest `updatedAt` wins. The server rejects an item sealed with an outdated key, and the client then re-seals it and sends it again.

Your thoughts leave a device only when you ask (delete one, sign out, delete the account, erase the device):

- **Another account:** signing in to a different account on a device that still holds unsynced changes of the previous one asks first. A push names the account it belongs to (`owner`), so if another tab signed in as someone else, the server ignores it, and the device keeps its changes until its own account signs in again.
- **Restored server:** when the server's database is older than the device's (a backup restored), the device offers all its thoughts again, and whichever copy is newer wins.
- **Eviction:** after your first own thought, the app asks the browser to keep its storage persistent.

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
- **Users:** every account with its role, creation date and number of synced thoughts, and a form to create accounts, admins included.
- **Hide:** on a collection's page, hide it from readers or show it again.
- **Import:** load a collection from CSV. Columns are `text, author, source, notes, lang, theme, color, font`, and only `text` is required. The import adds every row, or none if any row is invalid.
- **Settings:** `site_name`, `default_theme`, `home` (the collection on the home page, or reader's choice) and `allow_sign_up`.

## CLI

```sh
pnpm qoddy create-user <email> <name> [--admin]      # password from stdin
pnpm qoddy set-password <email>                      # password from stdin; signs out every device
pnpm qoddy set-role <email> <admin|user>
pnpm qoddy users
pnpm qoddy collections
pnpm qoddy add-collection <slug> <name>
pnpm qoddy hide-collection <slug>                    # readers' devices drop it until shown
pnpm qoddy show-collection <slug>
pnpm qoddy import <file.csv> [--collection <slug>]   # home collection unless given
pnpm qoddy settings
pnpm qoddy settings set <key> <value>                # site_name, allow_sign_up, default_theme, hide_from_search, home (a slug, or mine)
```

The CLI uses the same `DATABASE_PATH` as the server.

## Languages

The reading app speaks English and Russian. Readers pick a language on **Account → Appearance**.

- **Signed in:** the choice is saved to the account and follows the reader to every device. A new account starts in the language the app is showing, which is the browser's language unless the reader picked one.
- **Signed out:** the choice stays on the device. Without one, the app uses the first of the browser's languages it speaks, else English.
- **Server messages:** the server answers in English. Failures a reader can act on, such as a wrong password, also carry a `code`, and the app shows them in the reader's language. The admin dashboard and the CLI are English only.

To add a language:

1. List it in `LOCALES` in `src/lib/locales.ts`.
2. Add its catalog under `src/lib/client/locales/`, typed `Messages`, and register it in `CATALOGS` in `src/lib/client/i18n.svelte.ts`. `pnpm check` fails while a key is missing.

## Themes

The look is three independent choices, on **Account → Appearance**:

- **Light or dark:** System, Light or Dark. Every theme has both.
- **Color:** the accent. A default, or any color the reader picks (deepened on light paper and lightened on dark so it stays readable).
- **Theme:** everything else: paper, ink, typefaces, corners. Also in **Menu**.

Readers can also mix a pastel **paper** tone into the theme's paper. A signed-in reader's choices sync to their account; otherwise they stay on the device, and the theme falls back to the site's `default_theme`. A thought's own theme and color win while it is shown (its color tints the paper and sets the accent). The browser's bar (`theme-color`) follows the paper actually shown.

| Theme    | Id        | Character                                                               |
| -------- | --------- | ----------------------------------------------------------------------- |
| Neutral  | `morning` | Alegreya on cool sage paper, or green-black at night                    |
| Book     | `book`    | EB Garamond on cream stock, or sepia at night                           |
| Salon    | `vesper`  | Bodoni Moda in italic, a 19th-century evening: ivory, or deep aubergine |
| Confetti | `field`   | Bricolage Grotesque, heavy and round, on sunlit straw or a blue night   |

Ids are stored in accounts, settings and thoughts, so they never change, even when a theme is renamed.

To add a theme:

1. Add its tokens to `src/lib/styles/themes.css` under `[data-theme='<id>']`: every theme sets the same tokens, light and dark, and none sets the accent or `color-scheme`.
2. Add its id, name and paper colors to `THEMES` in `src/lib/themes.ts`, and its name to each catalog's `themes`. The pickers grow with the list.

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

Or with Docker on a host you reach over SSH:

```sh
scripts/deploy.sh --build local --domain qoddy.example user@host
scripts/deploy.sh --build remote user@host     # send the source and build there; the domain is remembered
```

- **Build info:** the script passes the current commit to the build (`QODDY_COMMIT`, with `-dirty` for uncommitted changes); it shows on Stats for nerds.
- **Container:** `qoddy`, plain HTTP on `--port` (default 3040), with `--restart unless-stopped`; each deploy replaces it. HTTPS is terminated upstream: point your proxy at `host:3040`. `--domain` sets `ORIGIN=https://<domain>`.
- **On the host:** the database is in the `qoddy-data` volume. `~/qoddy-deployment` holds `qoddy.env` (extra environment) and `domain.env` (the remembered domain).
- **First admin:** when the database has no accounts, the script asks for the admin's email and password.

- **What to deploy:** `build/`, `package.json` and production `node_modules` (`pnpm install --prod`).
- **Hosting:** serve it behind HTTPS. Service workers and Secure cookies require HTTPS everywhere except localhost.
- **Backups:** download one from the dashboard (Settings → Download backup), or run `sqlite3 qoddy.db ".backup backup.db"` while the server is running.

## Security

- **Sessions:** a random 256-bit token in a `session` cookie (HttpOnly, SameSite=Lax, and Secure except on plain-HTTP localhost).
  - The database stores only its SHA-256, so a leaked database does not leak sessions.
  - Sessions last 30 days and renew when used in their second half.
  - Signing out deletes the session server-side. Changing a password ends every session.
- **CSRF:** SvelteKit rejects cross-origin form posts. `/api` writes must be JSON from the same origin, otherwise they get a 403.
- **Passwords:** scrypt (N=2^15) with a random salt per user. Unknown emails still run a hash check, so a failed sign-in takes about the same time either way. Passwords over 1024 characters are refused before hashing.
- **Sign-in throttling:** after 10 wrong passwords for one email within 15 minutes, that email is refused (429) until the window passes. It is per email, so it works behind a proxy; the cost is that a stranger can hold one email's sign-in shut for a while (signed-in devices keep working). In memory: a restart forgets it.
- **Quotas:** a reader keeps at most 5,000 thoughts and 32 MB of synced data.
- **Personal thoughts:** the server stores them as given and never interprets them. Locked collections are end-to-end encrypted (see above).
- **Headers:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.

## Compared with the Rust version

Changed to fit "a thought of the day":

- **Dropped:** user-submitted public quotes and their two settings (`allow_user_quotes`, `allow_public_user_quotes`). Public collections are curated by admins, and readers write into their own collection.
- **Replaced:** Saved and Recently viewed are replaced by **Keep** into your thoughts.
- **Dropped:** language detection. Set `lang` explicitly.
- **Dropped:** the `pwa` setting. Offline support is the core of the app, not an option.

Not built yet:

- rate limiting of sign-up (sign-in is throttled per email)
- password reset (use `pnpm qoddy set-password`)
- changing roles or deleting other accounts in the dashboard (use the CLI)
