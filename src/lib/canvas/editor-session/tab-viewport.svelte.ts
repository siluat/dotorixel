import type { ViewportData, ViewportOps, ViewportSize } from '../viewport';
import type { DirtyNotifier } from './dirty-notifier';

export interface TabViewportDeps {
	readonly initial: ViewportData;
	readonly initialViewportSize: ViewportSize;
	readonly getCanvasDimensions: () => { readonly width: number; readonly height: number };
	readonly viewportOps: ViewportOps;
	readonly notifier: DirtyNotifier;
	readonly documentId: string;
}

/**
 * Per-tab binding of viewport state to the current canvas. Owns
 * `ViewportData` + `ViewportSize`, reads canvas dimensions through an injected
 * reactive getter, and emits `markDirty(documentId)` on every persistable
 * viewport mutation. `setViewportSize` is excluded — it tracks DOM-measurement
 * layout state which is not serialized by `TabState.toSnapshot()`.
 */
export class TabViewport {
	#viewportOps: ViewportOps;
	#notifier: DirtyNotifier;
	#documentId: string;
	#getCanvasDimensions: () => { readonly width: number; readonly height: number };

	viewport = $state<ViewportData>(null!);
	viewportSize = $state<ViewportSize>(null!);

	constructor(deps: TabViewportDeps) {
		this.viewport = deps.initial;
		this.viewportSize = deps.initialViewportSize;
		this.#getCanvasDimensions = deps.getCanvasDimensions;
		this.#viewportOps = deps.viewportOps;
		this.#notifier = deps.notifier;
		this.#documentId = deps.documentId;
	}

	apply(vd: ViewportData): void {
		this.viewport = vd;
		this.#notifier.markDirty(this.#documentId);
	}

	setViewportSize(size: ViewportSize): void {
		this.viewportSize = size;
	}

	zoomIn(): void {
		const newZoom = this.#viewportOps.nextZoomLevel(this.viewport.zoom);
		this.#zoomCenteredTo(newZoom);
	}

	zoomOut(): void {
		const newZoom = this.#viewportOps.prevZoomLevel(this.viewport.zoom);
		this.#zoomCenteredTo(newZoom);
	}

	zoomReset(): void {
		this.#zoomCenteredTo(1.0);
	}

	zoomFit(maxZoom: number = Infinity): void {
		const { width: cw, height: ch } = this.#getCanvasDimensions();
		this.apply(
			this.#viewportOps.fitToViewport(
				this.viewport,
				cw,
				ch,
				this.viewportSize.width,
				this.viewportSize.height,
				maxZoom
			)
		);
	}

	toggleGrid(): void {
		this.apply({ ...this.viewport, showGrid: !this.viewport.showGrid });
	}

	reclamp(): void {
		const { width: cw, height: ch } = this.#getCanvasDimensions();
		this.apply(
			this.#viewportOps.clampPan(
				this.viewport,
				cw,
				ch,
				this.viewportSize.width,
				this.viewportSize.height
			)
		);
	}

	#zoomCenteredTo(newZoom: number): void {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		this.apply(this.#viewportOps.zoomAtPoint(this.viewport, centerX, centerY, newZoom));
	}
}
