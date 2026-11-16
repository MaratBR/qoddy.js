<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const error = (field: string) =>
		form && 'field' in form && form.field === field ? form.error : null;
	const failed = $derived(form && 'values' in form ? form.values : null);
</script>

<h1>Users</h1>
<p class="muted">
	Everyone with an account. Admins can open this dashboard; users only sync their own thoughts.
</p>

<table>
	<thead>
		<tr>
			<th>Name</th>
			<th>Email</th>
			<th>Role</th>
			<th>Created</th>
			<th class="number">Thoughts</th>
		</tr>
	</thead>
	<tbody>
		{#each data.accounts as account (account.id)}
			<tr>
				<td
					>{account.name}{#if account.you}<span class="muted"> (you)</span>{/if}</td
				>
				<td>{account.email}</td>
				<td>{account.role === 'admin' ? 'Admin' : 'User'}</td>
				<td class="muted"><time datetime={account.created}>{account.created}</time></td>
				<td class="number">{account.thoughts}</td>
			</tr>
		{/each}
	</tbody>
</table>

<section>
	<h2>New account</h2>
	{#if form && 'created' in form}
		<p role="status" class="notice">Created {form.created}.</p>
	{/if}
	<form method="post" action="?/create">
		<div class="pair">
			<label class="field">
				<span>Name</span>
				<input name="name" required maxlength="100" autocomplete="off" value={failed?.name ?? ''} />
				{#if error('name')}<span class="error">{error('name')}</span>{/if}
			</label>
			<label class="field">
				<span>Email</span>
				<input
					name="email"
					type="email"
					required
					maxlength="254"
					autocomplete="off"
					value={failed?.email ?? ''}
				/>
				{#if error('email')}<span class="error">{error('email')}</span>{/if}
			</label>
		</div>
		<div class="pair">
			<label class="field">
				<span>Password</span>
				<input name="password" type="password" required autocomplete="new-password" />
				{#if error('password')}<span class="error">{error('password')}</span>{/if}
			</label>
			<label class="field">
				<span>Role</span>
				<select name="role">
					<option value="user" selected={(failed?.role ?? 'user') === 'user'}>User</option>
					<option value="admin" selected={failed?.role === 'admin'}>Admin</option>
				</select>
				{#if error('role')}<span class="error">{error('role')}</span>{/if}
			</label>
		</div>
		{#if form?.error && !('field' in form && form.field)}<p class="error">{form.error}</p>{/if}
		<button class="button">Create account</button>
	</form>
</section>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		margin: 1.5rem 0 3rem;
	}
	th {
		text-align: left;
		font-weight: 500;
		font-size: 0.85rem;
		color: var(--muted);
		padding: 0.4rem 0.75rem 0.4rem 0;
		border-bottom: 1px solid var(--rule);
	}
	td {
		padding: 0.7rem 0.75rem 0.7rem 0;
		border-bottom: 1px solid var(--rule);
		overflow-wrap: anywhere;
	}
	.number {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.notice {
		color: var(--accent);
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 1.25rem;
	}
	@media (max-width: 40rem) {
		.pair {
			grid-template-columns: 1fr;
		}
	}
</style>
