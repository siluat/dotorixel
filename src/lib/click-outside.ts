interface ClickOutsideParams {
	onClose: () => void;
	exclude?: HTMLElement[];
}

export function clickOutside(
	node: HTMLElement,
	params: ClickOutsideParams
): { destroy: () => void } {
	function handlePointerDown(event: PointerEvent) {
		const target = event.target as Node;
		if (node.contains(target)) return;
		if (params.exclude?.some((el) => el.contains(target))) return;
		params.onClose();
	}

	document.addEventListener('pointerdown', handlePointerDown);

	return {
		destroy() {
			document.removeEventListener('pointerdown', handlePointerDown);
		}
	};
}
