import { trackEvent } from './tracker';
import { getLocale } from '$lib/paraglide/runtime';

/** Fired when the user switches drawing tools */
export function trackToolUsage(tool: string): void {
	trackEvent('tool-use', { tool, locale: getLocale() });
}

/** Fired when the user changes canvas dimensions */
export function trackCanvasSize(width: number, height: number): void {
	trackEvent('canvas-resize', { width, height, locale: getLocale() });
}

/** Fired when the user exports artwork in any format */
export function trackExport(width: number, height: number, format: string): void {
	trackEvent('export', { width, height, format, locale: getLocale() });
}

/** Fired once when the editor page first loads, sending device info */
export function trackEditorOpen(editor: 'editor' | 'pebble' | 'pixel'): void {
	trackEvent('editor-open', {
		editor,
		locale: getLocale(),
		platform: navigator.platform,
		screenWidth: window.screen.width,
		screenHeight: window.screen.height,
		touchSupported: navigator.maxTouchPoints > 0 ? 'yes' : 'no'
	});
}

/** Fired when the user ends a session (page unload), tracking duration */
export function trackSessionEnd(durationSeconds: number): void {
	trackEvent('session-end', {
		duration: Math.round(durationSeconds),
		locale: getLocale()
	});
}
