import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
	stories: [{ directory: '../src/lib', files: '**/*.stories.@(ts|svelte)' }],
	addons: ['@storybook/addon-svelte-csf'],
	framework: '@storybook/sveltekit',
	viteFinal(config) {
		config.server ??= {};
		config.server.fs ??= {};
		config.server.fs.allow ??= [];
		config.server.fs.allow.push('wasm/pkg');
		return config;
	}
};

export default config;
