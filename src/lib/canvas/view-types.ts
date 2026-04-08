import { viewportFactory } from './wasm-backend';
import type { ViewportData, ViewportState } from './viewport';

export { extractViewportData } from './viewport';
export type { ViewportData } from './viewport';

export function restoreViewportState(data: ViewportData): ViewportState {
	return {
		viewport: viewportFactory.create(data.pixelSize, data.zoom, data.panX, data.panY),
		showGrid: data.showGrid,
		gridColor: data.gridColor
	};
}
