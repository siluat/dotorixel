<script lang="ts">
	import type { Component } from 'svelte';
	import type { ToolType } from './toolbar-types';
	import type { ToolbarButtonProps, ToolbarItem } from './toolbar-types';
	import ToolbarLayout from './ToolbarLayout.svelte';
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

	const items: ToolbarItem[] = $derived([
		{
			kind: 'button',
			icon: Pencil,
			label: 'Pencil (P)',
			active: activeTool === 'pencil',
			onclick: () => onToolChange('pencil')
		},
		{
			kind: 'button',
			icon: Slash,
			label: 'Line (L)',
			active: activeTool === 'line',
			onclick: () => onToolChange('line')
		},
		{
			kind: 'button',
			icon: Square,
			label: 'Rectangle (R)',
			active: activeTool === 'rectangle',
			onclick: () => onToolChange('rectangle')
		},
		{
			kind: 'button',
			icon: Circle,
			label: 'Ellipse (C)',
			active: activeTool === 'ellipse',
			onclick: () => onToolChange('ellipse')
		},
		{
			kind: 'button',
			icon: Eraser,
			label: 'Eraser (E)',
			active: activeTool === 'eraser',
			onclick: () => onToolChange('eraser')
		},
		{
			kind: 'button',
			icon: PaintBucket,
			label: 'Flood Fill (F)',
			active: activeTool === 'floodfill',
			onclick: () => onToolChange('floodfill')
		},
		{
			kind: 'button',
			icon: Pipette,
			label: 'Eyedropper (I)',
			active: activeTool === 'eyedropper',
			onclick: () => onToolChange('eyedropper')
		},
		{ kind: 'separator' },
		{ kind: 'button', icon: Undo2, label: 'Undo', disabled: !canUndo, onclick: onUndo },
		{ kind: 'button', icon: Redo2, label: 'Redo', disabled: !canRedo, onclick: onRedo },
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
			onclick: onGridToggle
		},
		{ kind: 'separator' },
		{ kind: 'button', icon: Trash2, label: 'Clear Canvas', onclick: onClear },
		{ kind: 'button', icon: Download, label: 'Export PNG', onclick: onExport }
	]);
</script>

<ToolbarLayout {Button} {items} />
