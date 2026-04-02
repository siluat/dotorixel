<script lang="ts">
	import type { Component } from 'svelte';
	import type { ToolType } from './toolbar-types';
	import type { ToolbarButtonProps, ToolbarItem } from './toolbar-types';
	import ToolbarLayout from './ToolbarLayout.svelte';
	import { formatShortcut } from '$lib/canvas/shortcut-display';
	import * as m from '$lib/paraglide/messages';
	import {
		Pencil,
		Slash,
		Square,
		Circle,
		Eraser,
		PaintBucket,
		Pipette,
		Move,
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
			label: `${m.tool_pencil()} (P)`,
			active: activeTool === 'pencil',
			shortcutHint: hint('P'),
			onclick: () => onToolChange('pencil')
		},
		{
			kind: 'button',
			icon: Slash,
			label: `${m.tool_line()} (L)`,
			active: activeTool === 'line',
			shortcutHint: hint('L'),
			onclick: () => onToolChange('line')
		},
		{
			kind: 'button',
			icon: Square,
			label: `${m.tool_rectangle()} (R)`,
			active: activeTool === 'rectangle',
			shortcutHint: hint('R'),
			onclick: () => onToolChange('rectangle')
		},
		{
			kind: 'button',
			icon: Circle,
			label: `${m.tool_ellipse()} (C)`,
			active: activeTool === 'ellipse',
			shortcutHint: hint('C'),
			onclick: () => onToolChange('ellipse')
		},
		{
			kind: 'button',
			icon: Eraser,
			label: `${m.tool_eraser()} (E)`,
			active: activeTool === 'eraser',
			shortcutHint: hint('E'),
			onclick: () => onToolChange('eraser')
		},
		{
			kind: 'button',
			icon: PaintBucket,
			label: `${m.tool_floodfill()} (F)`,
			active: activeTool === 'floodfill',
			shortcutHint: hint('F'),
			onclick: () => onToolChange('floodfill')
		},
		{
			kind: 'button',
			icon: Pipette,
			label: `${m.tool_eyedropper()} (I)`,
			active: activeTool === 'eyedropper',
			shortcutHint: hint('I'),
			onclick: () => onToolChange('eyedropper')
		},
		{
			kind: 'button',
			icon: Move,
			label: `${m.tool_move()} (M)`,
			active: activeTool === 'move',
			shortcutHint: hint('M'),
			onclick: () => onToolChange('move')
		},
		{ kind: 'separator' },
		{ kind: 'button', icon: Undo2, label: m.action_undo(), disabled: !canUndo, shortcutHint: hintCtrl('Z'), onclick: onUndo },
		{ kind: 'button', icon: Redo2, label: m.action_redo(), disabled: !canRedo, shortcutHint: hintCtrl('Y'), onclick: onRedo },
		{ kind: 'separator' },
		{ kind: 'button', icon: ZoomOut, label: m.action_zoomOut(), onclick: onZoomOut },
		{ kind: 'label', text: `${zoomPercent}%` },
		{ kind: 'button', icon: ZoomIn, label: m.action_zoomIn(), onclick: onZoomIn },
		{ kind: 'button', icon: Maximize2, label: m.action_fitToView(), onclick: onFit },
		{
			kind: 'button',
			icon: Grid3X3,
			label: `${m.action_toggleGrid()} (G)`,
			active: showGrid,
			shortcutHint: hint('G'),
			onclick: onGridToggle
		},
		{ kind: 'separator' },
		{ kind: 'button', icon: Trash2, label: m.action_clearCanvas(), onclick: onClear },
		{ kind: 'button', icon: Download, label: m.action_exportPng(), onclick: onExport }
	]);
</script>

<ToolbarLayout {Button} {items} />
