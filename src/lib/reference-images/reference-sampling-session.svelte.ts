import type { CanvasCoords } from '../canvas/canvas-model';
import type { Color } from '../canvas/color';
import { NO_EFFECTS, type ToolEffects } from '../canvas/draw-tool';
import { LOUPE_CENTER_INDEX } from '../canvas/sampling/loupe-config';
import {
	createSamplingSession,
	type SamplingSessionUpdatePointerParams
} from '../canvas/sampling/session.svelte';
import type { LoupeInputSource } from '../canvas/sampling/types';
import { createReferenceSamplingPort } from './sampling-port';
import type { DecodedImage } from './sample-pixel';

export interface ReferenceSamplingSessionDeps {
	readonly decode: (blob: Blob) => Promise<DecodedImage>;
}

/**
 * A sampling session against an imported reference image. Owns the async
 * port-binding state machine — blob decode, port binding, press-time
 * foreground preview, drag-time preview tracking, commit-on-release, and
 * race/stale handling — behind a small lifecycle interface.
 *
 * Effects flow back through return values only; callers apply them. The
 * read-only `isActive` / `grid` / `position` (plus `updatePointer` for the
 * pointer plumbing) match the underlying `SamplingSession` shape so the
 * loupe overlay can read them without knowing about the async wrapper.
 */
export interface ReferenceSamplingSession {
	start(blob: Blob, coords: CanvasCoords, src: LoupeInputSource): Promise<ToolEffects>;
	move(coords: CanvasCoords): ToolEffects;
	end(): ToolEffects;
	cancel(): void;
	readonly isActive: boolean;
	readonly grid: readonly (Color | null)[];
	readonly position: { readonly x: number; readonly y: number } | null;
	updatePointer(params: SamplingSessionUpdatePointerParams): void;
}

export function createReferenceSamplingSession(
	deps: ReferenceSamplingSessionDeps
): ReferenceSamplingSession {
	let port: ReturnType<typeof createReferenceSamplingPort> | null = null;
	const inner = createSamplingSession({
		getSamplingPort: () => {
			if (!port) throw new Error('Reference sampling session is not bound to a port');
			return port;
		}
	});

	let endPending = false;
	let startSeq = 0;

	function previewEffects(): ToolEffects {
		const center = inner.grid[LOUPE_CENTER_INDEX];
		if (!center || center.a === 0) return NO_EFFECTS;
		return [{ type: 'colorPick', target: 'foreground', color: center }];
	}

	function commitAndUnbind(): ToolEffects {
		const effects = inner.commit();
		port = null;
		return effects;
	}

	return {
		async start(blob, coords, src) {
			const seq = ++startSeq;
			endPending = false;
			// Discard any prior active session up front so move()/end() during
			// the decode gap can't operate on the stale grid.
			inner.cancel();
			port = null;
			let decoded;
			try {
				decoded = await deps.decode(blob);
			} catch {
				return NO_EFFECTS;
			}
			if (seq !== startSeq) return NO_EFFECTS;
			port = createReferenceSamplingPort(decoded);
			inner.start({ targetPixel: coords, commitTarget: 'foreground', inputSource: src });
			if (endPending) {
				endPending = false;
				return commitAndUnbind();
			}
			return previewEffects();
		},
		move(coords): ToolEffects {
			if (!inner.isActive) return NO_EFFECTS;
			inner.update(coords);
			return previewEffects();
		},
		end(): ToolEffects {
			if (inner.isActive) return commitAndUnbind();
			// Decode hasn't resolved yet — defer the commit so the late `start`
			// fires it once the port binds.
			endPending = true;
			return NO_EFFECTS;
		},
		cancel() {
			startSeq++;
			endPending = false;
			port = null;
			inner.cancel();
		},
		get isActive() {
			return inner.isActive;
		},
		get grid() {
			return inner.grid;
		},
		get position() {
			return inner.position;
		},
		updatePointer(params) {
			inner.updatePointer(params);
		}
	};
}
