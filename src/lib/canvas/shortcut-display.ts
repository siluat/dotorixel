/** Returns `true` when the runtime platform is macOS or iOS. SSR-safe: returns `false` on server. */
export function isMac(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/**
 * Formats a shortcut key for display.
 * On Mac, Ctrl-modified shortcuts use `⌘`; on other platforms they use `Ctrl+`.
 *
 * @example
 * formatShortcut('Z', { ctrl: true }) // → '⌘Z' (Mac) or 'Ctrl+Z' (others)
 * formatShortcut('G')                 // → 'G'
 */
export function formatShortcut(key: string, modifiers?: { ctrl?: boolean }): string {
	if (modifiers?.ctrl) {
		return isMac() ? `⌘${key}` : `Ctrl+${key}`;
	}
	return key;
}
