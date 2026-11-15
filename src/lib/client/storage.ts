// The reader's device preferences in localStorage. Private mode and blocked
// storage make it throw; then a choice lasts for this page only.

export function stored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function store(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// The choice lasts for this page only.
	}
}
