import type { Component, ComponentType, Snippet } from 'svelte';

export type ToolType = 'pencil' | 'eraser';

export interface ToolbarButtonProps {
	size?: 'sm' | 'md' | 'icon';
	active?: boolean;
	disabled?: boolean;
	title?: string;
	onclick?: (event: MouseEvent) => void;
	children: Snippet;
}

/** Accepts both Svelte 5 function components and Svelte 4 class components (e.g., lucide-svelte) */
type IconComponent = Component<{ size?: number }> | ComponentType;

export type ToolbarItem =
	| {
			kind: 'button';
			icon: IconComponent;
			label: string;
			onclick?: () => void;
			disabled?: boolean;
			active?: boolean;
	  }
	| { kind: 'separator' }
	| { kind: 'label'; text: string };
