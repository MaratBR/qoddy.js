<script lang="ts">
	// Account → Stats for nerds: which build the app and the server run, and
	// what this device keeps. Read-only; nothing here fetches.
	import { onMount } from 'svelte';
	import { library } from '#lib/client/library.svelte.ts';
	import { i18n, t } from '#lib/client/i18n.svelte.ts';

	const app = __QODDY_BUILD__;
	const stats = $derived(library.stats);

	let storage = $state<string | null>(null);
	let persisted = $state<boolean | null>(null);
	let worker = $state<string | null>(null);

	onMount(() => {
		void navigator.storage
			?.estimate?.()
			.then(({ usage, quota }) => {
				if (usage !== undefined) storage = `${bytes(usage)}${quota ? ` / ${bytes(quota)}` : ''}`;
			})
			.catch(() => undefined);
		void navigator.storage
			?.persisted?.()
			.then((value) => (persisted = value))
			.catch(() => undefined);
		const controller = navigator.serviceWorker?.controller;
		worker = controller ? controller.state : null;
	});

	function bytes(n: number): string {
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let unit = 0;
		while (n >= 1024 && unit < units.length - 1) {
			n /= 1024;
			unit++;
		}
		return `${n.toFixed(unit ? 1 : 0)} ${units[unit]}`;
	}

	const when = (time: string | number | null | undefined) =>
		time
			? new Date(time).toLocaleString(i18n.locale, { dateStyle: 'medium', timeStyle: 'medium' })
			: t.stats.unknown;
	const yesNo = (value: boolean | null) =>
		value === null ? t.stats.unknown : value ? t.stats.yes : t.stats.no;
</script>

<svelte:head>
	<title>{t.stats.title} · {library.settings.site_name}</title>
</svelte:head>

<main>
	<p><a class="link" href="/account">← {t.account.title}</a></p>
	<h1>{t.stats.title}</h1>

	<section>
		<h2>{t.stats.app}</h2>
		<dl>
			<dt>{t.stats.built}</dt>
			<dd>{when(app.built)}</dd>
			<dt>{t.stats.commit}</dt>
			<dd><code>{app.commit || t.stats.unknown}</code></dd>
			<dt>{t.stats.worker}</dt>
			<dd>{worker ?? t.stats.unknown}</dd>
		</dl>
	</section>

	<section>
		<h2>{t.stats.server}</h2>
		{#if stats.server}
			<dl>
				<dt>{t.stats.built}</dt>
				<dd>{when(stats.server.built)}</dd>
				<dt>{t.stats.commit}</dt>
				<dd><code>{stats.server.commit || t.stats.unknown}</code></dd>
				<dt>{t.stats.started}</dt>
				<dd>{when(stats.server.started)}</dd>
				<dt>{t.stats.database}</dt>
				<dd><code>{stats.db || t.stats.unknown}</code></dd>
			</dl>
		{:else}
			<p class="muted">{t.stats.notYet}</p>
		{/if}
	</section>

	<section>
		<h2>{t.stats.device}</h2>
		<dl>
			<dt>{t.stats.lastSync}</dt>
			<dd>{library.lastSync ? when(library.lastSync) : t.stats.never}</dd>
			<dt>{t.stats.revision}</dt>
			<dd>{stats.since}</dd>
			<dt>{t.stats.personalRevision}</dt>
			<dd>{stats.mineSince}</dd>
			<dt>{t.stats.collections}</dt>
			<dd>{library.collections.length}</dd>
			<dt>{t.stats.publicThoughts}</dt>
			<dd>{library.thoughts.size}</dd>
			<dt>{t.stats.yourThoughts}</dt>
			<dd>{library.mine.length}</dd>
			<dt>{t.stats.records}</dt>
			<dd>{stats.records}</dd>
			<dt>{t.stats.pending}</dt>
			<dd>{library.pending}</dd>
			<dt>{t.stats.sealed}</dt>
			<dd>{library.sealed}</dd>
			<dt>{t.stats.keys}</dt>
			<dd>{stats.keys}</dd>
			<dt>{t.stats.appLock}</dt>
			<dd>
				{library.appLock ? `${t.stats.on} (${t.appLock.kinds[library.appLock]})` : t.stats.off}
			</dd>
			<dt>{t.stats.storage}</dt>
			<dd>{storage ?? t.stats.unknown}</dd>
			<dt>{t.stats.persisted}</dt>
			<dd>{yesNo(persisted)}</dd>
			<dt>{t.stats.online}</dt>
			<dd>{yesNo(library.online)}</dd>
			<dt>{t.stats.language}</dt>
			<dd>{i18n.locale}</dd>
			<dt>{t.stats.theme}</dt>
			<dd>
				{library.theme}{library.mode ? ` · ${library.mode}` : ''}{library.accent
					? ` · ${library.accent}`
					: ''}{library.tone ? ` · ${library.tone}` : ''}
			</dd>
			<dt>{t.stats.userAgent}</dt>
			<dd class="small">{navigator.userAgent}</dd>
		</dl>
	</section>
</main>

<style>
	main {
		padding: clamp(1.5rem, 5vh, 3rem) clamp(1.25rem, 8vw, 7rem) 4rem;
		max-width: 44rem;
	}
	section {
		margin-top: 2rem;
	}
	h2 {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}
	dl {
		display: grid;
		grid-template-columns: minmax(9rem, auto) 1fr;
		gap: 0.35rem 1.25rem;
		margin: 0;
		font-family: var(--ui-font);
		font-size: 0.9rem;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.small {
		font-size: 0.8rem;
	}
	@media (max-width: 30rem) {
		dl {
			grid-template-columns: 1fr;
			gap: 0;
		}
		dd {
			margin-bottom: 0.5rem;
		}
	}
</style>
