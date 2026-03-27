import { redirect } from '@sveltejs/kit';
import { locales, baseLocale } from '$lib/paraglide/runtime';

export function load() {
	const browserLang = navigator.language.split('-')[0];
	const locale = (locales as readonly string[]).includes(browserLang) ? browserLang : baseLocale;
	redirect(307, `/${locale}/pebble`);
}
