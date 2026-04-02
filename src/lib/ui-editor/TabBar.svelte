<script lang="ts">
	import { Pencil, Palette, Settings } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	type MobileTab = 'draw' | 'colors' | 'settings';

	interface Props {
		activeTab: MobileTab;
		onTabChange: (tab: MobileTab) => void;
	}

	let { activeTab, onTabChange }: Props = $props();

	const tabIds: MobileTab[] = ['draw', 'colors', 'settings'];
	let activeIndex = $derived(tabIds.indexOf(activeTab));

	const tabs: { id: MobileTab; label: () => string; icon: typeof Pencil }[] = [
		{ id: 'draw', label: m.tab_draw, icon: Pencil },
		{ id: 'colors', label: m.tab_colors, icon: Palette },
		{ id: 'settings', label: m.tab_settings, icon: Settings }
	];
</script>

<nav class="tab-bar">
	<div class="pill" style:--active-index={activeIndex}>
		<div class="slide-indicator"></div>
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
		padding: 8px 16px;
		padding-bottom: max(20px, env(safe-area-inset-bottom, 0px));
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.tab-bar {
			padding: 8px 16px;
			padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
		}
	}

	.pill {
		position: relative;
		display: flex;
		width: 100%;
		height: 62px;
		padding: 4px;
		background: var(--ds-bg-surface);
		border: 1px solid var(--ds-border);
		border-radius: 36px;
	}

	.slide-indicator {
		position: absolute;
		top: 4px;
		bottom: 4px;
		left: 4px;
		width: calc((100% - 8px) / 3);
		border-radius: 26px;
		background: var(--ds-accent);
		transform: translateX(calc(var(--active-index) * 100%));
		transition: transform 180ms cubic-bezier(0.645, 0.045, 0.355, 1);
		will-change: transform;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.slide-indicator {
			transition: none;
		}
	}

	.tab-item {
		position: relative;
		z-index: 1;
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
		color: #ffffff;
	}

	.tab-label {
		font-family: var(--ds-font-body);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.5px;
	}
</style>
