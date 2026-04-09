const FOCUSABLE_SELECTOR = 'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps focus within a container element on Tab/Shift+Tab keydown events.
 * Cycles through focusable elements, wrapping around at both ends.
 * Call this from a keydown handler when `event.key === 'Tab'`.
 */
export function trapFocus(event: KeyboardEvent, container: HTMLElement): void {
	const focusable = [
		...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
	];
	if (focusable.length === 0) return;

	const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
	event.preventDefault();

	if (event.shiftKey) {
		const prev = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
		focusable[prev].focus();
	} else {
		const next = currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
		focusable[next].focus();
	}
}
