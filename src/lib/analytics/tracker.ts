export interface AnalyticsEvent {
	name: string;
	data?: Record<string, string | number>;
}

type TrackFn = (event: AnalyticsEvent) => void;

let trackImpl: TrackFn = () => {};

export function setTracker(track: TrackFn): void {
	trackImpl = track;
}

export function trackEvent(name: string, data?: Record<string, string | number>): void {
	trackImpl({ name, data });
}
