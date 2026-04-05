<script lang="ts">
	import { X, Plus } from 'lucide-svelte';

	interface Props {
		tabs: { name: string }[];
		activeTabIndex: number;
		onTabClick: (index: number) => void;
		onTabClose: (index: number) => void;
		onNewTab: () => void;
	}

	let { tabs, activeTabIndex, onTabClick, onTabClose, onNewTab }: Props = $props();

	let scrollContainer: HTMLDivElement | undefined = $state();

	$effect(() => {
		const idx = activeTabIndex;
		if (!scrollContainer) return;
		const activeEl = scrollContainer.children[idx] as HTMLElement | undefined;
		activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
	});

	function focusTab(index: number) {
		onTabClick(index);
		(scrollContainer?.children[index] as HTMLElement)?.focus();
	}

	function handleTabKeydown(e: KeyboardEvent, index: number) {
		let target: number | null = null;
		switch (e.key) {
			case 'ArrowRight':
				target = (index + 1) % tabs.length;
				break;
			case 'ArrowLeft':
				target = (index - 1 + tabs.length) % tabs.length;
				break;
			case 'Home':
				target = 0;
				break;
			case 'End':
				target = tabs.length - 1;
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				onTabClick(index);
				return;
			default:
				return;
		}
		e.preventDefault();
		focusTab(target);
	}
</script>

<div class="tab-strip" role="tablist">
	<div class="tabs-scroll" bind:this={scrollContainer}>
		{#each tabs as tab, index}
			<div
				class="tab"
				class:active={index === activeTabIndex}
				role="tab"
				tabindex={index === activeTabIndex ? 0 : -1}
				aria-selected={index === activeTabIndex}
				onclick={() => onTabClick(index)}
				onkeydown={(e) => handleTabKeydown(e, index)}
			>
				<span class="tab-name">{tab.name}</span>
				<button
					class="close-btn"
					aria-label="Close {tab.name}"
					tabindex={-1}
					onclick={(e) => {
						e.stopPropagation();
						onTabClose(index);
					}}
				>
					<X size={10} />
				</button>
			</div>
		{/each}
		<button class="new-tab-btn" aria-label="New tab" onclick={onNewTab}>
			<Plus size={14} />
		</button>
	</div>
</div>

<style>
	.tab-strip {
		display: flex;
		background: var(--ds-bg-surface);
		border-bottom: 1px solid var(--ds-border-subtle);
		height: 28px;
	}

	@media (min-width: 600px) {
		.tab-strip {
			height: 32px;
		}
	}

	@media (min-width: 1024px) {
		.tab-strip {
			height: 36px;
		}
	}

	.tabs-scroll {
		display: flex;
		align-items: stretch;
		overflow-x: auto;
		scrollbar-width: none;
		flex: 1;
	}

	.tabs-scroll::-webkit-scrollbar {
		display: none;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--ds-space-2);
		padding: 0 var(--ds-space-2) 0 var(--ds-space-3);
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-xs);
		color: var(--ds-text-secondary);
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
		border: none;
		background: none;
		border-bottom: 2px solid transparent;
		outline: none;
	}

	@media (min-width: 600px) {
		.tab {
			padding: 0 var(--ds-space-3) 0 var(--ds-space-4);
			font-size: var(--ds-font-size-sm);
		}
	}

	.tab:hover {
		background: var(--ds-bg-hover);
	}

	.tab:focus-visible {
		outline: 2px solid var(--ds-accent);
		outline-offset: -2px;
	}

	.tab.active {
		background: var(--ds-bg-elevated);
		color: var(--ds-text-primary);
		border-bottom-color: var(--ds-accent);
	}

	.tab-name {
		pointer-events: none;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border: none;
		background: none;
		color: var(--ds-text-tertiary);
		cursor: pointer;
		border-radius: var(--ds-radius-sm);
		padding: 0;
	}

	.close-btn:hover {
		color: var(--ds-text-secondary);
		background: var(--ds-bg-active);
	}

	.close-btn:focus-visible {
		outline: 2px solid var(--ds-accent);
		outline-offset: -2px;
	}

	.new-tab-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		margin-left: var(--ds-space-2);
		border: none;
		background: none;
		color: var(--ds-text-tertiary);
		cursor: pointer;
		border-radius: 4px;
		padding: 0;
		flex-shrink: 0;
		align-self: center;
	}

	.new-tab-btn:hover {
		background: var(--ds-bg-hover);
		color: var(--ds-text-secondary);
	}

	.new-tab-btn:focus-visible {
		outline: 2px solid var(--ds-accent);
		outline-offset: -2px;
	}
</style>
