// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { flushSync } from 'svelte';
import { createModal } from './modal.svelte';

function keyEvent(key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
	return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
}

describe('createModal', () => {
	describe('ESC handling', () => {
		it('ESC calls onClose', () => {
			const onClose = vi.fn();

			const cleanup = $effect.root(() => {
				const modal = createModal({ onClose });
				modal.handleKeyDown(keyEvent('Escape'));
			});

			expect(onClose).toHaveBeenCalledOnce();
			cleanup();
		});

		it('ESC calls escapeGuard first; if true, onClose is not called', () => {
			const onClose = vi.fn();
			const escapeGuard = vi.fn(() => true);

			const cleanup = $effect.root(() => {
				const modal = createModal({ onClose, escapeGuard });
				modal.handleKeyDown(keyEvent('Escape'));
			});

			expect(escapeGuard).toHaveBeenCalledOnce();
			expect(onClose).not.toHaveBeenCalled();
			cleanup();
		});

		it('ESC calls onClose when escapeGuard returns false', () => {
			const onClose = vi.fn();
			const escapeGuard = vi.fn(() => false);

			const cleanup = $effect.root(() => {
				const modal = createModal({ onClose, escapeGuard });
				modal.handleKeyDown(keyEvent('Escape'));
			});

			expect(escapeGuard).toHaveBeenCalledOnce();
			expect(onClose).toHaveBeenCalledOnce();
			cleanup();
		});
	});

	describe('focus trapping', () => {
		it('Tab delegates to trapFocus when containerEl is set', () => {
			const container = document.createElement('div');
			const btn1 = document.createElement('button');
			const btn2 = document.createElement('button');
			container.appendChild(btn1);
			container.appendChild(btn2);
			document.body.appendChild(container);
			btn1.focus();

			const cleanup = $effect.root(() => {
				const modal = createModal({ onClose: vi.fn() });
				modal.containerEl = container;

				modal.handleKeyDown(keyEvent('Tab'));
			});

			expect(document.activeElement).toBe(btn2);
			cleanup();
		});

		it('Tab passes through when focusTrap is false', () => {
			const container = document.createElement('div');
			const btn1 = document.createElement('button');
			const btn2 = document.createElement('button');
			container.appendChild(btn1);
			container.appendChild(btn2);
			document.body.appendChild(container);
			btn1.focus();

			const cleanup = $effect.root(() => {
				const modal = createModal({ onClose: vi.fn(), focusTrap: false });
				modal.containerEl = container;

				const event = keyEvent('Tab');
				modal.handleKeyDown(event);

				// Focus should NOT have moved by trapFocus
				expect(event.defaultPrevented).toBe(false);
			});

			cleanup();
		});
	});

	describe('backdrop click', () => {
		it('handleBackdropClick calls onClose', () => {
			const onClose = vi.fn();

			const cleanup = $effect.root(() => {
				const modal = createModal({ onClose });
				modal.handleBackdropClick();
			});

			expect(onClose).toHaveBeenCalledOnce();
			cleanup();
		});
	});

	describe('scroll lock', () => {
		it('sets body overflow to hidden and restores on cleanup', () => {
			document.body.style.overflow = 'auto';

			const cleanup = $effect.root(() => {
				createModal({ onClose: vi.fn() });
			});
			flushSync();

			expect(document.body.style.overflow).toBe('hidden');

			cleanup();
			expect(document.body.style.overflow).toBe('auto');
		});

		it('scroll lock disabled when scrollLock is false', () => {
			document.body.style.overflow = 'auto';

			const cleanup = $effect.root(() => {
				createModal({ onClose: vi.fn(), scrollLock: false });
			});
			flushSync();

			expect(document.body.style.overflow).toBe('auto');
			cleanup();
		});
	});

	describe('non-modal keys', () => {
		it('ignores non-Escape, non-Tab keys', () => {
			const onClose = vi.fn();

			const cleanup = $effect.root(() => {
				const modal = createModal({ onClose });
				modal.handleKeyDown(keyEvent('Enter'));
				modal.handleKeyDown(keyEvent('a'));
			});

			expect(onClose).not.toHaveBeenCalled();
			cleanup();
		});
	});
});
