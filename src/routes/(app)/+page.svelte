<script lang="ts">
	// Home: the site's thought of the day, or, when the site turns that off,
	// one of your own.
	import { library } from '#lib/client/library.svelte.ts';
	import DayView from '#lib/components/DayView.svelte';
</script>

<DayView slug={library.settings.daily ? 'default' : 'mine'} />
