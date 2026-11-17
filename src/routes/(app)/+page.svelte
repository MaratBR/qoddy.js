<script lang="ts">
	// Home: the thought of the day from the collection this device chose
	// (Account → Collections), else the site's, else Your thoughts.
	import { library } from '#lib/client/library.svelte.ts';
	import DayView from '#lib/components/DayView.svelte';
</script>

<!-- A home collection not synced yet shows as missing, as any unknown one does. -->
{#key library.homeSlug}
	<DayView slug={library.homeSlug} />
{/key}
