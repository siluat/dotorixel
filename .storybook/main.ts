import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
	stories: [{ directory: '../src/lib', files: '**/*.stories.@(ts|svelte)' }],
	addons: ['@storybook/addon-svelte-csf'],
	framework: '@storybook/sveltekit'
};

export default config;
