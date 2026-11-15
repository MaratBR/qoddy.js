// The reading app's words in English. This catalog defines the shape: every
// other locale must have the same keys and the same function signatures.

import type { ThoughtProblem } from '../../thought.ts';
import { MIN_PASSWORD, type ErrorCode } from '../../wire.ts';

const thoughts = (n: number) => (n === 1 ? 'thought' : 'thoughts');
const changes = (n: number) => (n === 1 ? '1 change' : `${n} changes`);

export const en = {
	themes: { morning: 'Morning', vesper: 'Vesper', field: 'Field' } as Record<string, string>,

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
		theme: 'Theme',
		lightOrDark: 'Light or dark',
		modes: { system: 'System', light: 'Light', dark: 'Dark' },
		ownTheme: 'This thought is set in its own theme.',
		language: 'Language',
		account: 'Account',
		signInOrCreate: 'Sign in or create an account',
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
		random: 'Another of your thoughts'
	},

	thought: {
		about: 'About this thought',
		hideNotes: 'Hide the notes',
		keep: 'Keep',
		kept: 'Kept in your thoughts',
		couldNotKeep: 'Could not keep it.',
		share: 'Share',
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
		lock: 'Lock',
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
		languageSaved: 'Your account remembers the language on every device.'
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
		editNotes: 'Edit notes',
		previewNotes: 'Preview notes',
		notesHint:
			'What it means to you, or where it came from. **Bold**, *italic*, lists, > quotes and [links](https://…) work.',
		style: 'Style and language',
		theme: 'Theme',
		readersTheme: 'The reader’s own',
		ownColor: 'A color of its own',
		color: 'Color',
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
		changedElsewhere: 'Your thoughts changed on another device. Try again.'
	},

	serverErrors: {
		wrong_password: 'Wrong email or password.',
		email_invalid: 'Enter a valid email address.',
		email_taken: 'An account with this email already exists.',
		name_invalid: 'Enter a name (up to 100 characters).',
		password_short: `Use at least ${MIN_PASSWORD} characters.`,
		password_long: 'That password is too long.',
		sign_up_closed: 'Sign-up is closed on this site.'
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
