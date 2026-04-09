import { untrack } from 'svelte';

const DEFAULT_ANIMATION_MS = 500;

export interface DrawerStateOptions {
	open: () => boolean;
	onClose: () => void;
	onReset?: () => void;
	animationMs?: number;
}

export interface DrawerState {
	readonly drawerOpen: boolean;
	handleOpenChange: (isOpen: boolean) => void;
}

/**
 * Manages the open/close state synchronization for vaul-svelte bottom sheets.
 *
 * Handles the desynchronization between parent `open` prop and the internal
 * `drawerOpen` state needed for close animations. User-initiated close
 * (swipe) is delayed by `animationMs` so vaul can finish its slide-down
 * animation before the parent removes the element from the DOM.
 */
export function createDrawerState(options: DrawerStateOptions): DrawerState {
	const { open, onClose, onReset, animationMs = DEFAULT_ANIMATION_MS } = options;

	let drawerOpen = $state(false);
	let pendingClose: ReturnType<typeof setTimeout> | undefined;

	function clearPendingClose() {
		if (pendingClose !== undefined) {
			clearTimeout(pendingClose);
			pendingClose = undefined;
		}
	}

	$effect(() => {
		if (open()) {
			clearPendingClose();
			drawerOpen = true;
		} else if (pendingClose === undefined) {
			if (untrack(() => drawerOpen)) {
				drawerOpen = false;
				onReset?.();
			}
		}
	});

	// Clear pending timeout on component destroy
	$effect(() => {
		return () => clearPendingClose();
	});

	function handleOpenChange(isOpen: boolean) {
		clearPendingClose();
		if (isOpen) {
			drawerOpen = true;
		} else {
			onClose();
			pendingClose = setTimeout(() => {
				pendingClose = undefined;
				drawerOpen = false;
				onReset?.();
			}, animationMs);
		}
	}

	return {
		get drawerOpen() {
			return drawerOpen;
		},
		handleOpenChange
	};
}
