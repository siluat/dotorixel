import type { LiveSampleTool } from '../draw-tool';

/**
 * Samples a pixel color during a drag and commits it on release. The drag
 * lets the user refine the sampled target while a Loupe overlay previews
 * the surrounding grid. All state (grid, center, bounds) lives in the
 * shared `samplingSession`; this export is a pure kind marker telling
 * ToolRunner which lifecycle to run.
 */
export const eyedropperTool: LiveSampleTool = {
	kind: 'liveSample'
};
