import { trapFocus } from './trap-focus';

export interface ModalOptions {
	onClose: () => void;
	scrollLock?: boolean;
	focusTrap?: boolean;
	escapeGuard?: () => boolean;
}

export interface ModalBehavior {
	containerEl: HTMLElement | undefined;
	handleKeyDown: (event: KeyboardEvent) => void;
	handleBackdropClick: () => void;
}

/**
 * Consolidates modal dialog behavior: scroll lock, focus trapping,
 * ESC-to-close, and backdrop click handling.
 *
 * Scroll lock saves and restores `body.style.overflow` via `$effect`.
 * For nested modals, pass an `escapeGuard` that returns true if the
 * child consumed the ESC press.
 */
export function createModal(options: ModalOptions): ModalBehavior {
	const {
		onClose,
		scrollLock = true,
		focusTrap: enableFocusTrap = true,
		escapeGuard
	} = options;

	let containerEl = $state<HTMLElement | undefined>(undefined);

	if (scrollLock) {
		$effect(() => {
			const original = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = original;
			};
		});
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (escapeGuard?.()) return;
			onClose();
		} else if (event.key === 'Tab' && enableFocusTrap && containerEl) {
			trapFocus(event, containerEl);
		}
	}

	function handleBackdropClick() {
		onClose();
	}

	return {
		get containerEl() {
			return containerEl;
		},
		set containerEl(el: HTMLElement | undefined) {
			containerEl = el;
		},
		handleKeyDown,
		handleBackdropClick
	};
}
