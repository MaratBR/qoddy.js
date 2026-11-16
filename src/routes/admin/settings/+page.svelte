<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const error = (field: string) => (form?.field === field ? form.error : null);
	const failed = $derived(form && 'values' in form ? form.values : null);
	const s = $derived(data.settings);
</script>

<h1>Settings</h1>

{#if form && 'saved' in form}
	<p role="status" class="notice">Saved. Readers get the changes on their next sync.</p>
{/if}

<form method="post">
	<label class="field">
		<span>Site name</span>
		<input name="site_name" required maxlength="60" value={failed?.site_name ?? s.site_name} />
		{#if error('site_name')}<span class="error">{error('site_name')}</span>{/if}
	</label>

	<label class="field">
		<span>Default theme</span>
		<select name="default_theme">
			{#each data.themes as theme (theme.id)}
				<option value={theme.id} selected={(failed?.default_theme ?? s.default_theme) === theme.id}
					>{theme.name}</option
				>
			{/each}
		</select>
		<span class="hint">For readers who have not picked one. A thought’s own theme still wins.</span>
		{#if error('default_theme')}<span class="error">{error('default_theme')}</span>{/if}
	</label>

	<label class="field">
		<span>Home page</span>
		<select name="home">
			{#each data.collections as collection (collection.id)}
				<option value={collection.slug} selected={(failed?.home ?? data.home) === collection.slug}
					>{collection.name}</option
				>
			{/each}
			<option value={data.mine} selected={(failed?.home ?? data.home) === data.mine}
				>Reader’s choice (their own thoughts)</option
			>
		</select>
		<span class="hint">
			A collection gives every reader the same thought of the day. Reader’s choice turns that off:
			each reader’s home page shows one of their own thoughts.
		</span>
		{#if error('home')}<span class="error">{error('home')}</span>{/if}
	</label>

	<div class="field">
		<label class="check">
			<input
				type="checkbox"
				name="allow_sign_up"
				checked={failed ? failed.allow_sign_up === 'on' : s.allow_sign_up}
			/>
			Anyone can create an account
		</label>
		<span class="hint">
			Accounts sync a reader’s own thoughts between devices. Without one, thoughts stay on the
			device.
		</span>
	</div>

	<div class="field">
		<label class="check">
			<input
				type="checkbox"
				name="hide_from_search"
				checked={failed ? failed.hide_from_search === 'on' : s.hide_from_search}
			/>
			Hide this website from search engines
		</label>
		<span class="hint">
			Asks search engines not to list the site. Well-behaved ones listen; pages already listed drop
			out when they next visit. It does not keep anyone from opening the site.
		</span>
	</div>

	{#if form?.error && !('field' in form && form.field)}<p class="error">{form.error}</p>{/if}
	<button class="button">Save settings</button>
</form>

<section class="backup">
	<h2>Backup</h2>
	<p class="hint">
		A copy of the whole SQLite database: collections, accounts and readers’ synced thoughts. Keep it
		private.
	</p>
	<a class="button" href="/admin/backup" download>Download backup</a>
</section>

<style>
	.backup {
		max-width: 36rem;
		margin-top: 2.5rem;
	}
	form {
		max-width: 36rem;
		margin-top: 1.5rem;
	}
	.notice {
		color: var(--accent);
	}
	.field:has(.check) {
		margin-block: 1.25rem;
	}
</style>
