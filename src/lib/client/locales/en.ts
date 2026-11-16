// The reading app's words in English. This catalog defines the shape: every
// other locale must have the same keys and the same function signatures.

import type { ThoughtProblem } from '../../thought.ts';
import { MIN_PASSWORD, type ErrorCode } from '../../wire.ts';

const thoughts = (n: number) => (n === 1 ? 'thought' : 'thoughts');
const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`);

export const en = {
	themes: {
		morning: 'Neutral',
		book: 'Book',
		vesper: 'Salon',
		field: 'Confetti'
	} as Record<string, string>,

	bar: {
		offline: 'offline',
		write: 'Write',
		menu: 'Menu',
		updateReady: (site: string) => `A new version of ${site} is ready.`,
		reload: 'Reload'
	},

	menu: {
		close: 'Close',
		read: 'Read',
		today: 'Today',
		home: 'Home page',
		theme: 'Theme',
		lightOrDark: 'Light or dark',
		modes: { system: 'System', light: 'Light', dark: 'Dark' },
		ownTheme: 'This thought is set in its own theme.',
		ownColor: 'This thought is set in its own color.',
		language: 'Language',
		account: 'Account',
		signInOrCreate: 'Sign in or create an account',
		signIn: 'Sign in',
		accent: 'Color',
		defaultColor: 'Default',
		paper: 'Paper',
		themeOwn: 'The theme’s own',
		otherAccent: 'Another accent',
		tones: {
			blush: 'Blush',
			peach: 'Peach',
			butter: 'Butter',
			mint: 'Mint',
			sky: 'Sky',
			lavender: 'Lavender',
			sand: 'Sand'
		} as Record<string, string>,
		dashboard: 'Dashboard'
	},

	status: {
		offline: 'Offline. You are reading what is on this device.',
		pending: (n: number) => `${changes(n)} waiting to sync.`,
		pendingLocked: (n: number) => `${changes(n)} wait until you unlock your thoughts here.`,
		inSync: 'Your thoughts are in sync.',
		local: 'Your thoughts are kept on this device. Sign in to keep them in sync.'
	},

	common: {
		yourThoughts: 'Your thoughts',
		writeAThought: 'Write a thought',
		edit: 'Edit',
		password: 'Password',
		nothingHere: 'Nothing here',
		noCollection: 'There is no collection at this address.',
		noCollectionOffline:
			'There is no collection at this address on this device yet. Connect once to fetch it.',
		noThoughtsYet: 'No thoughts here yet.',
		notOnDevice: 'Not on this device',
		backToToday: 'Back to today'
	},

	day: {
		days: 'Days',
		previous: 'Previous day',
		next: 'Next day',
		mineIntro:
			'Write down a thought you want to come back to. Each day brings one of yours back, the way this page shows one from the collection.',
		keepHint: 'Or keep thoughts you meet: the bookmark under any of them adds it here.',
		permalink: 'Permalink',
		random: 'Another thought'
	},

	thought: {
		about: 'About this thought',
		keep: 'Keep',
		kept: 'Kept in your thoughts',
		couldNotKeep: 'Could not keep it.',
		share: 'Share',
		shareImage: 'Share as image',
		couldNotShareImage: 'Could not make the image.',
		saveImage: 'Save image',
		imageSiteName: 'Site name on the image',
		untitled: 'A thought',
		fromCollection: 'From',
		fromMine: 'From',
		yourThoughtsLink: 'your thoughts',
		gone: 'This thought does not exist, or it was deleted.',
		goneOffline: 'This thought is not on this device. Connect once to fetch it.'
	},

	collection: {
		count: (n: number) => (n === 1 ? 'one thought' : `all ${n} ${thoughts(n)}`),
		todays: 'Today’s thought',
		search: 'Search',
		searchHint: 'Words, an author, a source',
		noneMine: 'You have not written or kept any thoughts yet.',
		noMatch: (words: string) => `Nothing matches “${words}”.`
	},

	unlock: {
		prompt: 'Your thoughts are locked with a password. Enter it to read them on this device.',
		unlocking: 'Unlocking…',
		unlock: 'Unlock',
		failed: 'Could not unlock.'
	},

	account: {
		title: 'Account',
		lastSynced: (when: string) => `Last synced ${when}.`,
		signOut: 'Sign out',
		signOutHint: 'Signing out removes your thoughts from this device. They stay in your account.',
		signOutConfirm: (n: number) =>
			`${n === 1 ? '1 of your changes has' : `${n} of your changes have`} not reached the server yet and will be lost. Sign out anyway?`,
		couldNotSignOut: 'Could not sign out.',
		lock: 'Thought lock',
		lockedInfo:
			'Your thoughts are encrypted on your devices before they are sent, with a key made from your password. The server cannot read them.',
		lockOffer:
			'Lock your thoughts with a password: they are encrypted on your devices before they are sent, and the server cannot read them. If you forget the password, nobody can recover them.',
		newPassword: 'New password',
		repeat: 'Repeat it',
		tooShort: 'Use at least 8 characters.',
		mismatch: 'The passwords do not match.',
		removeConfirm: 'Remove the lock? Your thoughts will be stored unencrypted.',
		removed: 'The lock is removed.',
		changed: 'Password changed.',
		locked: 'Your thoughts are locked.',
		couldNotChangeLock: 'Could not change the lock.',
		encrypting: 'Encrypting…',
		changePassword: 'Change password',
		lockWithPassword: 'Lock with password',
		removeLock: 'Remove the lock',
		lockDevice: 'Lock this device now',
		lockNeedsConnection: 'Changing the lock needs a connection.',
		signIn: 'Sign in',
		createHeading: 'Create an account',
		createButton: 'Create account',
		haveAccount: 'I have an account',
		localLede: (n: number) =>
			`Your ${n === 1 ? 'thought stays' : `${n} thoughts stay`} on this device until you sign in. Then they move into your account and follow you to your other devices.`,
		lede: 'An account keeps your own thoughts on all your devices. Reading needs no account.',
		name: 'Name',
		email: 'Email',
		signInNeedsConnection: 'Signing in needs a connection.',
		languageSaved: 'Your account remembers the language on every device.',
		switchConfirm: (n: number, owner: string | null) =>
			`This device has ${n === 1 ? '1 change' : `${n} changes`} by ${owner ?? 'another account'} that never reached the server. Signing in to a different account discards ${n === 1 ? 'it' : 'them'}. Export your thoughts first to keep a copy. Sign in anyway?`,
		data: 'Your data',
		exportHint:
			'Download your thoughts as Markdown files in a zip, made on this device. Those already in your account are in “synced”, those only on this device in “this-device”.',
		exportButton: 'Export thoughts',
		exporting: 'Exporting…',
		nothingToExport: 'You have no thoughts to export yet.',
		couldNotExport: 'Could not export.',
		deleteAccount: 'Delete account',
		deleteHint:
			'Deletes your account and every thought in it, on the server and on this device, at once. It cannot be undone.',
		deleteConfirm: (email: string) =>
			`Delete the account ${email} and all its thoughts? Export them first if you want a copy.`,
		deleteConfirmAgain: 'Are you sure? Everything is deleted right away and cannot be recovered.',
		deleting: 'Deleting…',
		couldNotDelete: 'Could not delete the account.',
		deleted: 'Your account is deleted.',
		stats: 'Stats for nerds',
		settings: 'Settings',
		appearance: 'Appearance',
		privacy: 'Privacy',
		export: 'Export',
		lockNeedsAccount:
			'Signed in, you can lock your thoughts with a password, so they are encrypted before they leave your devices.'
	},

	appLock: {
		delete: 'Delete',
		digitsEntered: (n: number, of: number) => `${n} of ${of} digits entered`,
		enterPasscode: 'Enter Passcode',
		newPasscode: 'Enter a new passcode',
		repeatPasscode: 'Re-enter your new passcode',
		mismatchRetry: 'Passcodes did not match. Try again.',
		setPasscode: 'Set passcode',
		title: 'App lock',
		offer:
			'Ask for a passcode or password whenever the app opens on this device. Everything it keeps here is then stored encrypted and only read into memory once unlocked.',
		onInfo: (kind: 'pin' | 'password') =>
			`The app asks for your ${kind === 'pin' ? 'passcode' : 'password'} when it opens, and again after five minutes away. Everything it keeps on this device is encrypted.`,
		kinds: { pin: '6-digit passcode', password: 'Password' },
		repeat: 'Repeat it',
		tooShort: 'Use at least 8 characters.',
		mismatch: 'They do not match.',
		turnOn: 'Turn on',
		change: 'Change',
		turnOff: 'Turn off',
		turnOffConfirm: 'Turn the app lock off? Everything on this device will be stored unencrypted.',
		lockNow: 'Lock now',
		working: 'Encrypting…',
		on: 'The app lock is on.',
		changed: 'Changed.',
		off: 'The app lock is off.',
		failed: 'Could not change the app lock.',
		weakHint:
			'A passcode keeps out someone who picks up your device. Against someone who copies its storage, a long password is much stronger.',
		forgetHint:
			'If you forget it, the only way back in is to erase this device’s data. Thoughts in your account come back when you sign in; the rest is lost.',
		prompt: (site: string) => `${site} is locked`,
		enter: (kind: 'pin' | 'password'): string =>
			kind === 'pin' ? 'Enter your passcode.' : 'Enter your password.',
		unlock: 'Unlock',
		unlocking: 'Unlocking…',
		wrong: 'That is not it.',
		forgot: 'Forgot it?',
		eraseConfirm:
			'Erase everything this app keeps on this device? Thoughts that are not in your account are lost for good.',
		eraseConfirmAgain: 'Are you sure? This cannot be undone.',
		erase: 'Erase this device’s data'
	},

	stats: {
		title: 'Stats for nerds',
		app: 'This app',
		server: 'The server',
		device: 'This device',
		built: 'Built',
		commit: 'Commit',
		started: 'Running since',
		unknown: 'unknown',
		notYet: 'not seen yet',
		database: 'Database',
		revision: 'Revision',
		personalRevision: 'Your revision',
		lastSync: 'Last sync',
		never: 'never',
		collections: 'Collections',
		publicThoughts: 'Public thoughts',
		yourThoughts: 'Your thoughts',
		records: 'Personal records',
		pending: 'Waiting to sync',
		sealed: 'Locked (unreadable here)',
		keys: 'Thought-lock keys',
		appLock: 'App lock',
		on: 'on',
		off: 'off',
		storage: 'Storage used',
		persisted: 'Protected from eviction',
		yes: 'yes',
		no: 'no',
		worker: 'Service worker',
		online: 'Online',
		language: 'Language',
		theme: 'Theme',
		userAgent: 'Browser'
	},

	write: {
		editTitle: 'Edit thought',
		notAmongYours: 'This thought is not among yours here.',
		seeYours: 'See your thoughts',
		label: 'The thought',
		placeholder: 'A thought worth keeping',
		author: 'Who said or wrote it',
		authorHint: 'Leave empty if it is yours',
		source: 'Where it comes from',
		sourceHint: 'A book, a talk, a walk',
		notes: 'Notes',
		notesPlaceholder: 'What it means to you, or where it came from',
		format: {
			label: 'Formatting',
			bold: 'Bold',
			italic: 'Italic',
			heading: 'Heading',
			list: 'List',
			numbered: 'Numbered list',
			quote: 'Quote',
			link: 'Link',
			linkPrompt: 'Link address (leave empty to remove the link)'
		},
		style: 'Style and language',
		theme: 'Theme',
		readersTheme: 'The reader’s own',
		ownColor: 'A color of its own',
		color: 'Color',
		colors: {
			violet: 'Violet',
			blue: 'Blue',
			teal: 'Teal',
			green: 'Green',
			ochre: 'Ochre',
			terracotta: 'Terracotta',
			crimson: 'Crimson',
			rose: 'Rose',
			slate: 'Slate'
		},
		otherColor: 'Another color',
		saturationBrightness: 'Saturation and brightness',
		saturationBrightnessValue: (saturation: number, brightness: number) =>
			`Saturation ${saturation}%, brightness ${brightness}%`,
		hue: 'Hue',
		hex: 'Hex code',
		font: 'Font',
		fontHint: 'Any Google Fonts family, e.g. Lora',
		language: 'Language',
		languageHint: 'A tag like en, fr or zh-Hans',
		saving: 'Saving…',
		save: 'Save',
		cancel: 'Cancel',
		delete: 'Delete',
		deleteConfirm: 'Delete this thought? This cannot be undone.',
		couldNotSave: 'Could not save it.',
		savedLocal: 'Saved on this device.',
		signIn: 'Sign in',
		/** Follows the sign-in link directly, so it carries its own leading space. */
		signInTail: ' to keep your thoughts on all your devices.',
		encrypted: 'Encrypted on this device before it syncs.'
	},

	errors: {
		generic: 'Something went wrong. Try again.',
		offline: 'You are offline. Try again once you are connected.',
		unreachable: 'Could not reach the server.',
		server: (status: number) => `The server answered ${status}.`,
		full: 'Your collection is full: some thoughts stay on this device only.',
		unlockFirst: 'Unlock your thoughts on this device first.',
		wrongLockPassword: 'That password does not open your thoughts.',
		signInToLock: 'Sign in to lock your thoughts.',
		changedElsewhere: 'Your thoughts changed on another device. Try again.',
		unlockToExport: 'Unlock your thoughts on this device to export them.',
		otherAccount: (owner: string | null) =>
			`This browser is signed in to another account, but this device has unsynced changes by ${owner ?? 'the previous account'}. Sign in as ${owner ?? 'that account'} here to sync them.`
	},

	serverErrors: {
		wrong_password: 'Wrong email or password.',
		email_invalid: 'Enter a valid email address.',
		email_taken: 'An account with this email already exists.',
		name_invalid: 'Enter a name (up to 100 characters).',
		password_short: `Use at least ${MIN_PASSWORD} characters.`,
		password_long: 'That password is too long.',
		sign_up_closed: 'Sign-up is closed on this site.',
		too_many_attempts: 'Too many wrong passwords. Try again in a few minutes.',
		last_admin: 'You are the only admin. Make someone else an admin first.'
	} satisfies Record<ErrorCode, string>,

	thoughtErrors: (problem: ThoughtProblem, limit: number): string =>
		({
			required: 'Write the thought itself.',
			too_long: `Keep it under ${limit} characters.`,
			lang: 'Use a language tag like en, ru or zh-Hans.',
			theme: 'Choose a known theme.',
			color: 'Use a color like #8a2c1d.',
			font: 'Use a Google Fonts family name (letters, digits and spaces).'
		})[problem]
};

export type Messages = typeof en;
