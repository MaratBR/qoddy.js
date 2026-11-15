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

	<div class="field">
		<label class="check">
			<input type="checkbox" name="daily" checked={failed ? failed.daily === 'on' : s.daily} />
			Show the thought of the day on the home page
		</label>
		<span class="hint">
			Taken from the default collection. When off, the home page shows the reader’s own thoughts.
		</span>
	</div>

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

	{#if form?.error && !('field' in form && form.field)}<p class="error">{form.error}</p>{/if}
	<button class="button">Save settings</button>
</form>

<style>
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
