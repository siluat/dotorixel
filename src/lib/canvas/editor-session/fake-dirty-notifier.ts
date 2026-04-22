import type { DirtyNotifier } from './dirty-notifier';

/**
 * Recording fake for `DirtyNotifier`. Tests can assert on `dirtyCalls` and
 * `tabRemovedCalls` to verify that editor-session layers emit the right
 * signals without wiring up a real `AutoSave` + `SessionPersistence`.
 */
export interface FakeDirtyNotifier extends DirtyNotifier {
	readonly dirtyCalls: ReadonlyArray<string>;
	readonly tabRemovedCalls: ReadonlyArray<string>;
	reset(): void;
}

export function createFakeDirtyNotifier(): FakeDirtyNotifier {
	const dirtyCalls: string[] = [];
	const tabRemovedCalls: string[] = [];

	return {
		markDirty(documentId) {
			dirtyCalls.push(documentId);
		},
		notifyTabRemoved(documentId) {
			tabRemovedCalls.push(documentId);
		},
		get dirtyCalls() {
			return dirtyCalls;
		},
		get tabRemovedCalls() {
			return tabRemovedCalls;
		},
		reset() {
			dirtyCalls.length = 0;
			tabRemovedCalls.length = 0;
		}
	};
}
