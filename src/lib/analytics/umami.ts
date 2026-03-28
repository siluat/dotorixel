import { env } from '$env/dynamic/public';
import { setTracker, type AnalyticsEvent } from './tracker';

declare global {
	interface Window {
		umami?: {
			track: ((event: string, data?: Record<string, string | number>) => void) &
				((
					callback: (props: {
						url: string;
						referrer: string;
						website: string;
					}) => {
						url?: string;
						referrer?: string;
						website?: string;
						data?: Record<string, string | number>;
					}
				) => void);
		};
	}
}

export function isAnalyticsEnabled(): boolean {
	return Boolean(env.PUBLIC_UMAMI_WEBSITE_ID) && Boolean(env.PUBLIC_UMAMI_SRC);
}

export function getUmamiConfig() {
	return {
		websiteId: env.PUBLIC_UMAMI_WEBSITE_ID ?? '',
		src: env.PUBLIC_UMAMI_SRC ?? ''
	};
}

export function initUmami(): void {
	if (!isAnalyticsEnabled()) return;

	setTracker((event: AnalyticsEvent) => {
		window.umami?.track(event.name, event.data);
	});
}
