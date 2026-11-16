<script lang="ts" module>
	// Line icons on a 24-unit grid, drawn with the text color. Decorative only:
	// the control that holds one carries the words (aria-label and title).
	const paths = {
		bookmark: 'M6.5 3.5h11v17L12 16l-5.5 4.5z',
		link: 'M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2',
		edit: 'M4 20h4.5L19.5 9 15 4.5 4 15.5zM12.5 7l4.5 4.5',
		share: 'M12 3.5v11M7.5 8 12 3.5 16.5 8M5.5 12v8.5h13V12',
		image: 'M4.5 4.5h15v15h-15zM4.5 16.5l4.5-4.5 4 4 2.5-2.5 4 4M15.5 9.5a1.5 1.5 0 1 0 0-.01',
		shuffle:
			'M3.5 7H7c4.5 0 5.5 10 10 10h3.5M3.5 17H7c1.4 0 2.4-1 3.2-2.4M20.5 7H17c-1.4 0-2.4 1-3.2 2.4M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5',
		list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
		bold: 'M7.5 4.5h5.25a3.75 3.75 0 0 1 0 7.5H7.5zM7.5 12h6.25a4 4 0 0 1 0 8H7.5z',
		italic: 'M10.5 4.5h7M6.5 19.5h7M14 4.5l-4 15',
		heading: 'M6 4.5v15M18 4.5v15M6 12h12',
		numbers: 'M10 6.5h10M10 12h10M10 17.5h10M4 5.25 5.5 4v5M4 14.25a1.5 1.5 0 1 1 2.5 1.1L4 18.5h3',
		quote: 'M5 4.5v15M9.5 7h10M9.5 12h10M9.5 17h6',
		previous: 'M19.5 12h-15M10.5 6l-6 6 6 6',
		next: 'M4.5 12h15M13.5 6l6 6-6 6',
		down: 'M12 4.5v15M6 13.5l6 6 6-6',
		chevron: 'M9.5 5.5 16 12l-6.5 6.5',
		updown: 'M8 9.5l4-4 4 4M8 14.5l4 4 4-4',
		check: 'M5 12.5l4.5 4.5L19 7.5',
		search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM15.5 15.5l5 5'
	};
	export type IconName = keyof typeof paths;
</script>

<script lang="ts">
	let { name, filled = false }: { name: IconName; filled?: boolean } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	aria-hidden="true"
	fill={filled ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"><path d={paths[name]} /></svg
>
