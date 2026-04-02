import type { Action } from 'svelte/action';

const SHOW_DELAY = 400;
const GAP = 6;
const VIEWPORT_MARGIN = 4;

type Placement = 'top' | 'right';

export type TooltipParam = string | { text: string; placement?: Placement } | undefined;

let stylesInjected = false;

function injectStyles(): void {
	if (stylesInjected) return;

	const style = document.createElement('style');
	style.textContent = `
		[data-dotorixel-tooltip] {
			position: fixed;
			z-index: 10000;
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 6px 10px;
			border: 1px solid transparent;
			border-radius: 6px;
			background: #2D210F;
			color: #FDFBF8;
			font-family: var(--ds-font-body, 'Galmuri11', system-ui, sans-serif);
			font-size: 11px;
			font-weight: 500;
			line-height: 1.3;
			white-space: nowrap;
			pointer-events: none;
			opacity: 0;
			transition: opacity 0.12s ease-out;
		}
		[data-dotorixel-tooltip].visible {
			opacity: 1;
		}
		:root[data-theme="dark"] [data-dotorixel-tooltip] {
			border-color: #5C4A32;
		}
		[data-tooltip-shortcut] {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 18px;
			height: 18px;
			padding: 0 5px;
			border-radius: 4px;
			background: #4A3D2A;
			color: #D8CFC2;
			font-family: 'GeistPixel-Square', monospace;
			font-size: 11px;
			font-weight: 600;
		}
	`;
	document.head.appendChild(style);
	stylesInjected = true;
}

function resolveParam(param: TooltipParam): { text: string | undefined; placement: Placement } {
	if (param === undefined) return { text: undefined, placement: 'top' };
	if (typeof param === 'string') return { text: param, placement: 'top' };
	return { text: param.text, placement: param.placement ?? 'top' };
}

/** Parse "Name (Key)" into { name, shortcut? } */
export function parseTitle(text: string): { name: string; shortcut?: string } {
	const match = text.match(/(.*?)\s*\(([^)]+)\)\s*$/);
	if (match) {
		return { name: match[1], shortcut: match[2] };
	}
	return { name: text };
}

function createTooltipElement(text: string): HTMLDivElement {
	const el = document.createElement('div');
	el.setAttribute('data-dotorixel-tooltip', '');

	const { name, shortcut } = parseTitle(text);

	const nameSpan = document.createElement('span');
	nameSpan.setAttribute('data-tooltip-label', '');
	nameSpan.textContent = name;
	el.appendChild(nameSpan);

	if (shortcut) {
		const shortcutSpan = document.createElement('span');
		shortcutSpan.setAttribute('data-tooltip-shortcut', '');
		shortcutSpan.textContent = shortcut;
		el.appendChild(shortcutSpan);
	}

	return el;
}

function positionTooltip(tooltipEl: HTMLDivElement, anchorRect: DOMRect, placement: Placement): void {
	const tooltipRect = tooltipEl.getBoundingClientRect();
	let top: number;
	let left: number;

	if (placement === 'right') {
		// Vertically centered to the right of the button
		top = anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2;
		left = anchorRect.right + GAP;

		// Flip left if not enough space on right
		if (left + tooltipRect.width > window.innerWidth - VIEWPORT_MARGIN) {
			left = anchorRect.left - tooltipRect.width - GAP;
		}

		// Clamp vertical
		top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - tooltipRect.height - VIEWPORT_MARGIN));
	} else {
		// Centered above the button
		top = anchorRect.top - tooltipRect.height - GAP;
		left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;

		// Flip below if not enough space above
		if (top < VIEWPORT_MARGIN) {
			top = anchorRect.bottom + GAP;
		}

		// Clamp horizontal
		left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - tooltipRect.width - VIEWPORT_MARGIN));
	}

	tooltipEl.style.top = `${top}px`;
	tooltipEl.style.left = `${left}px`;
}

export const tooltip: Action<HTMLElement, TooltipParam> = (node, param) => {
	let { text: currentText, placement: currentPlacement } = resolveParam(param);
	let tooltipEl: HTMLDivElement | null = null;
	let showTimeout: ReturnType<typeof setTimeout> | null = null;

	function show(): void {
		if (!currentText) return;
		injectStyles();

		tooltipEl = createTooltipElement(currentText);
		document.body.appendChild(tooltipEl);

		positionTooltip(tooltipEl, node.getBoundingClientRect(), currentPlacement);

		// Force reflow then show
		tooltipEl.offsetHeight;
		tooltipEl.classList.add('visible');
	}

	function hide(): void {
		if (showTimeout !== null) {
			clearTimeout(showTimeout);
			showTimeout = null;
		}
		if (tooltipEl) {
			tooltipEl.remove();
			tooltipEl = null;
		}
	}

	function onMouseEnter(): void {
		showTimeout = setTimeout(show, SHOW_DELAY);
	}

	function onMouseLeave(): void {
		hide();
	}

	function onMouseDown(): void {
		hide();
	}

	if (currentText) {
		node.removeAttribute('title');
	}

	node.addEventListener('mouseenter', onMouseEnter);
	node.addEventListener('mouseleave', onMouseLeave);
	node.addEventListener('mousedown', onMouseDown);

	return {
		update(newParam: TooltipParam) {
			const resolved = resolveParam(newParam);
			currentText = resolved.text;
			currentPlacement = resolved.placement;
			if (currentText) {
				node.removeAttribute('title');
			}
			// If tooltip is visible with stale text, recreate it
			if (tooltipEl && currentText) {
				const rect = node.getBoundingClientRect();
				tooltipEl.remove();
				tooltipEl = createTooltipElement(currentText);
				document.body.appendChild(tooltipEl);
				positionTooltip(tooltipEl, rect, currentPlacement);
				tooltipEl.offsetHeight;
				tooltipEl.classList.add('visible');
			}
		},
		destroy() {
			hide();
			node.removeEventListener('mouseenter', onMouseEnter);
			node.removeEventListener('mouseleave', onMouseLeave);
			node.removeEventListener('mousedown', onMouseDown);
		}
	};
};
