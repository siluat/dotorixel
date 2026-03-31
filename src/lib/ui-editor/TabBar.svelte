<script lang="ts">
	import { Pencil, Palette, Settings } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	type MobileTab = 'draw' | 'colors' | 'settings';

	interface Props {
		activeTab: MobileTab;
		onTabChange: (tab: MobileTab) => void;
	}

	let { activeTab, onTabChange }: Props = $props();

	const tabs: { id: MobileTab; label: () => string; icon: typeof Pencil }[] = [
		{ id: 'draw', label: m.tab_draw, icon: Pencil },
		{ id: 'colors', label: m.tab_colors, icon: Palette },
		{ id: 'settings', label: m.tab_settings, icon: Settings }
	];
</script>

<nav class="tab-bar">
	<div class="pill">
		{#each tabs as tab}
			<button
				class="tab-item"
				class:active={activeTab === tab.id}
				onclick={() => onTabChange(tab.id)}
				aria-label={tab.label()}
				aria-current={activeTab === tab.id ? 'page' : undefined}
			>
				<tab.icon size={18} />
				<span class="tab-label">{tab.label()}</span>
			</button>
		{/each}
	</div>
</nav>

<style>
	.tab-bar {
		display: flex;
		justify-content: center;
		padding: 8px 16px 20px 16px;
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.tab-bar {
			padding: 8px 16px;
		}
	}

	.pill {
		display: flex;
		width: 100%;
		height: 62px;
		padding: 4px;
		background: var(--ds-bg-surface);
		border: 1px solid var(--ds-border);
		border-radius: 36px;
	}

	.tab-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 4px;
		border: none;
		background: none;
		border-radius: 26px;
		color: var(--ds-text-secondary);
		cursor: pointer;
		padding: 0;
	}

	.tab-item:hover:not(.active) {
		background: var(--ds-bg-hover);
	}

	.tab-item.active {
		background: var(--ds-accent);
		color: #ffffff;
	}

	.tab-label {
		font-family: var(--ds-font-body);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.5px;
	}
</style>
