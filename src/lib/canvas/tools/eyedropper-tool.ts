import { NO_EFFECTS, type LiveSampleTool } from '../draw-tool';
import { customTool, type AuthoredTool } from '../tool-authoring';

/**
 * Samples a pixel color during a drag and commits it on release. The drag
 * lets the user refine the sampled target while a Loupe overlay previews
 * the surrounding grid. All grid/center/bounds state lives in the shared
 * `samplingSession` on `SessionHost`; this tool owns the drag lifecycle.
 */
export const eyedropperTool: LiveSampleTool & AuthoredTool = customTool({
	id: 'eyedropper',
	legacy: { kind: 'liveSample' },
	open(host, spec) {
		let started = false;
		const commitTarget: 'foreground' | 'background' =
			spec.drawButton === 2 ? 'background' : 'foreground';

		return {
			start() {
				return NO_EFFECTS;
			},
			draw(current) {
				if (!started) {
					host.sampling.start({
						targetPixel: current,
						commitTarget,
						inputSource: spec.inputSource
					});
					started = true;
				} else {
					host.sampling.update(current);
				}
				return NO_EFFECTS;
			},
			modifierChanged() {
				return NO_EFFECTS;
			},
			end() {
				return host.sampling.commit();
			}
		};
	}
});
