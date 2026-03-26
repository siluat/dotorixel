<script lang="ts">
	import type { Component } from 'svelte';
	import type { ToolType } from './toolbar-types';
	import type { ToolbarButtonProps, ToolbarItem } from './toolbar-types';
	import ToolbarLayout from './ToolbarLayout.svelte';
	import { formatShortcut } from '$lib/canvas/shortcut-display';
	import {
		Pencil,
		Slash,
		Square,
		Circle,
		Eraser,
		PaintBucket,
		Pipette,
		Undo2,
		Redo2,
		ZoomOut,
		ZoomIn,
		Maximize2,
		Grid3X3,
		Trash2,
		Download
	} from 'lucide-svelte';

	interface Props {
		Button: Component<ToolbarButtonProps>;
		activeTool: ToolType;
		canUndo: boolean;
		canRedo: boolean;
		zoomPercent: number;
		showGrid: boolean;
		showShortcutHints?: boolean;
		onToolChange: (tool: ToolType) => void;
		onUndo: () => void;
		onRedo: () => void;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onFit: () => void;
		onGridToggle: () => void;
		onClear: () => void;
		onExport: () => void;
	}

	let {
		Button,
		activeTool,
		canUndo,
		canRedo,
		zoomPercent,
		showGrid,
		showShortcutHints = false,
		onToolChange,
		onUndo,
		onRedo,
		onZoomIn,
		onZoomOut,
		onFit,
		onGridToggle,
		onClear,
		onExport
	}: Props = $props();

	function hint(key: string): string | undefined {
		return showShortcutHints ? key : undefined;
	}

	function hintCtrl(key: string): string | undefined {
		return showShortcutHints ? formatShortcut(key, { ctrl: true }) : undefined;
	}

	const items: ToolbarItem[] = $derived([
		{
			kind: 'button',
			icon: Pencil,
			label: 'Pencil (P)',
			active: activeTool === 'pencil',
			shortcutHint: hint('P'),
			onclick: () => onToolChange('pencil')
		},
		{
			kind: 'button',
			icon: Slash,
			label: 'Line (L)',
			active: activeTool === 'line',
			shortcutHint: hint('L'),
			onclick: () => onToolChange('line')
		},
		{
			kind: 'button',
			icon: Square,
			label: 'Rectangle (R)',
			active: activeTool === 'rectangle',
			shortcutHint: hint('R'),
			onclick: () => onToolChange('rectangle')
		},
		{
			kind: 'button',
			icon: Circle,
			label: 'Ellipse (C)',
			active: activeTool === 'ellipse',
			shortcutHint: hint('C'),
			onclick: () => onToolChange('ellipse')
		},
		{
			kind: 'button',
			icon: Eraser,
			label: 'Eraser (E)',
			active: activeTool === 'eraser',
			shortcutHint: hint('E'),
			onclick: () => onToolChange('eraser')
		},
		{
			kind: 'button',
			icon: PaintBucket,
			label: 'Flood Fill (F)',
			active: activeTool === 'floodfill',
			shortcutHint: hint('F'),
			onclick: () => onToolChange('floodfill')
		},
		{
			kind: 'button',
			icon: Pipette,
			label: 'Eyedropper (I)',
			active: activeTool === 'eyedropper',
			shortcutHint: hint('I'),
			onclick: () => onToolChange('eyedropper')
		},
		{ kind: 'separator' },
		{ kind: 'button', icon: Undo2, label: 'Undo', disabled: !canUndo, shortcutHint: hintCtrl('Z'), onclick: onUndo },
		{ kind: 'button', icon: Redo2, label: 'Redo', disabled: !canRedo, shortcutHint: hintCtrl('Y'), onclick: onRedo },
		{ kind: 'separator' },
		{ kind: 'button', icon: ZoomOut, label: 'Zoom Out', onclick: onZoomOut },
		{ kind: 'label', text: `${zoomPercent}%` },
		{ kind: 'button', icon: ZoomIn, label: 'Zoom In', onclick: onZoomIn },
		{ kind: 'button', icon: Maximize2, label: 'Fit to View', onclick: onFit },
		{
			kind: 'button',
			icon: Grid3X3,
			label: 'Toggle Grid (G)',
			active: showGrid,
			shortcutHint: hint('G'),
			onclick: onGridToggle
		},
		{ kind: 'separator' },
		{ kind: 'button', icon: Trash2, label: 'Clear Canvas', onclick: onClear },
		{ kind: 'button', icon: Download, label: 'Export PNG', onclick: onExport }
	]);
</script>

<ToolbarLayout {Button} {items} />
