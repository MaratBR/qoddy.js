<script lang="ts">
	// Shared by the app and the admin dashboard: theme tokens and base styles.
	import '#lib/styles/themes.css';
	import '#lib/styles/base.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

{@render children()}
