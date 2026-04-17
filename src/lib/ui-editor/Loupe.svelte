<script lang="ts">
	import type { Color } from '$lib/canvas/color';
	import { colorToHex } from '$lib/canvas/color';

	interface Props {
		/** 9×9 row-major grid of sampled colors (81 entries). */
		grid: readonly Color[];
		/** Color at the sample target; `null` when the target is out of canvas. */
		centerColor: Color | null;
		/** Pointer position in viewport coordinates; `null` hides the loupe. */
		screenPointer: { x: number; y: number } | null;
	}

	let { grid, centerColor, screenPointer }: Props = $props();

	/** Center cell index of a 9×9 row-major grid. */
	const CENTER_INDEX = 40;
	const EM_DASH = '—';

	// 칩 hex 표기: commit 가능한 샘플(센터 픽셀이 불투명)일 때만 표시. 그 외엔 em-dash.
	// "commit 가능" 판별은 sampling-session이 권위를 가지지만, UI는 alpha > 0만으로도 충분히 근사함.
	const canonicalHex = $derived(
		centerColor && centerColor.a > 0 ? colorToHex(centerColor) : null
	);
	const displayHex = $derived(canonicalHex ? canonicalHex.toUpperCase() : null);

	/**
	 * Transparent(a=0) 및 OoC(없는 셀)의 전용 스타일(체커보드/해치)은 issue 066에서 도입 예정.
	 * 현재 트레이서 슬라이스에서는 투명 셀을 surface 톤으로 폴백하여 시각적으로 자리만 유지한다.
	 */
	function cellFill(color: Color): string {
		if (color.a === 0) return 'var(--ds-bg-surface)';
		return `rgb(${color.r}, ${color.g}, ${color.b})`;
	}
</script>

{#if screenPointer}
	<div
		class="loupe"
		data-testid="loupe-root"
		role="presentation"
		style:--pointer-x="{screenPointer.x}px"
		style:--pointer-y="{screenPointer.y}px"
	>
		<div class="grid" role="presentation">
			{#each grid as color, i (i)}
				<div
					class="cell"
					class:cell--center={i === CENTER_INDEX}
					style:background-color={cellFill(color)}
				></div>
			{/each}
		</div>
		<div class="chip" data-testid="loupe-hex-chip">
			<div
				class="swatch"
				class:swatch--empty={canonicalHex === null}
				style:background-color={canonicalHex ?? 'var(--ds-bg-surface)'}
			></div>
			<span class="hex" class:hex--muted={displayHex === null} data-testid="loupe-hex-text">
				{displayHex ?? EM_DASH}
			</span>
		</div>
	</div>
{/if}

<style>
	.loupe {
		/* 포인터 기준 오른쪽+위 20px 오프셋(upper-right quadrant 기본값).
		   쿼드런트 플립은 issue 067에서 추가, 터치 전용 오프셋(80px)은 issue 068에서 추가. */
		position: fixed;
		left: var(--pointer-x);
		top: var(--pointer-y);
		transform: translate(20px, calc(-100% - 20px));
		pointer-events: none;
		z-index: 1000;

		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--ds-space-3);
		padding: var(--ds-space-3);

		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border);
		border-radius: var(--ds-radius-md);
		box-shadow: var(--ds-shadow-md);
	}

	.grid {
		/* 9개 셀(24px) + 8개 구분선(1px) = 224px. gap을 --ds-border 배경으로 채워 그리드라인을 구현. */
		display: grid;
		grid-template-columns: repeat(9, 24px);
		grid-template-rows: repeat(9, 24px);
		gap: 1px;
		width: 224px;
		height: 224px;
		background: var(--ds-border);
	}

	.cell {
		width: 24px;
		height: 24px;
	}

	/* 중앙 픽셀 하이라이트 — 2px 흰색 안쪽 링 + 2px 검정 바깥쪽 링.
	   어떤 픽셀 색상에도 대비가 유지되도록 테마 토큰이 아닌 리터럴 #000/#FFF를 사용한다. */
	.cell--center {
		position: relative;
		z-index: 1; /* sibling cell들 위로 링이 올라오도록 */
	}

	.cell--center::before,
	.cell--center::after {
		content: '';
		position: absolute;
		pointer-events: none;
		box-sizing: border-box;
	}

	/* 바깥쪽 검정 링: 셀 경계에서 바깥쪽으로 4px 확장, 두께 2px → 실제 위치 -4 ~ -2. */
	.cell--center::before {
		inset: -4px;
		border: 2px solid #000;
	}

	/* 안쪽 흰색 링: 셀 경계에서 바깥쪽으로 2px 확장, 두께 2px → 실제 위치 -2 ~ 0. */
	.cell--center::after {
		inset: -2px;
		border: 2px solid #fff;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-surface);
	}

	.swatch {
		width: 16px;
		height: 16px;
		border-radius: 3px;
		border: 1px solid var(--ds-border);
		box-sizing: border-box;
	}

	.hex {
		font-family: var(--ds-font-mono);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-primary);
	}

	.hex--muted {
		color: var(--ds-text-tertiary);
	}
</style>
