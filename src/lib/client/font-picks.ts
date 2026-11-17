// The families the font picker shows before a search: well-known faces that
// suit quotations, a few of each kind. Each must be in google-fonts.json (a
// test checks). Their groups' names are in each catalog's `write.fontGroups`.

export const FONT_PICKS = [
	{
		id: 'classic',
		families: [
			'EB Garamond',
			'Cormorant Garamond',
			'Playfair Display',
			'Libre Baskerville',
			'Lora',
			'Crimson Pro',
			'Spectral',
			'Fraunces'
		]
	},
	{
		id: 'modern',
		families: [
			'Inter',
			'Montserrat',
			'Josefin Sans',
			'Raleway',
			'Work Sans',
			'Manrope',
			'Space Grotesk',
			'Jost'
		]
	},
	{
		id: 'handwritten',
		families: [
			'Caveat',
			'Homemade Apple',
			'Kalam',
			'Indie Flower',
			'Shadows Into Light',
			'Reenie Beanie',
			'La Belle Aurore',
			'Amatic SC'
		]
	},
	{
		id: 'script',
		families: [
			'Great Vibes',
			'Parisienne',
			'Pinyon Script',
			'Allura',
			'Italianno',
			'Tangerine',
			'Sacramento',
			'Lobster'
		]
	},
	{
		id: 'bold',
		families: [
			'Bebas Neue',
			'Abril Fatface',
			'Oswald',
			'Anton',
			'Alfa Slab One',
			'Yeseva One',
			'Archivo Black',
			'Righteous'
		]
	},
	{
		id: 'typewriter',
		families: [
			'Special Elite',
			'Courier Prime',
			'Cutive Mono',
			'IBM Plex Mono',
			'Space Mono',
			'Anonymous Pro'
		]
	},
	{
		id: 'old',
		families: [
			'Cinzel',
			'IM Fell English',
			'UnifrakturMaguntia',
			'Uncial Antiqua',
			'Pirata One',
			'Almendra'
		]
	}
] as const;

export type FontPickGroup = (typeof FONT_PICKS)[number]['id'];
