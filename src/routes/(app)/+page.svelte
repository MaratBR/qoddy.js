<script lang="ts">
	// Home: the thought of the day from the collection the site picks, or one of
	// your own, when the site leaves it to readers or the reader chose them (menu).
	import { library } from '#lib/client/library.svelte.ts';
	import DayView from '#lib/components/DayView.svelte';

	const home = $derived(library.collections.find((c) => library.isHome(c)));
</script>

<!-- A home collection not synced yet shows as missing, as any unknown one does. -->
<DayView slug={library.homeId === null ? 'mine' : (home?.slug ?? '')} />
