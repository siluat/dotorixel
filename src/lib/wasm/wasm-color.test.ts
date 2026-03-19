import { describe, it, expect } from 'vitest';
import { WasmColor } from '$wasm/dotorixel_wasm';

describe('WasmColor', () => {
	it('creates a color with RGBA values', () => {
		const color = new WasmColor(255, 128, 0, 200);
		expect(color.r).toBe(255);
		expect(color.g).toBe(128);
		expect(color.b).toBe(0);
		expect(color.a).toBe(200);
	});

	it('creates a transparent color', () => {
		const color = WasmColor.transparent();
		expect(color.r).toBe(0);
		expect(color.g).toBe(0);
		expect(color.b).toBe(0);
		expect(color.a).toBe(0);
	});

	it('converts to hex string', () => {
		const color = new WasmColor(255, 0, 128, 255);
		expect(color.to_hex()).toBe('#ff0080');
	});

	it('parses from hex string', () => {
		const color = WasmColor.from_hex('#ff0080');
		expect(color.r).toBe(255);
		expect(color.g).toBe(0);
		expect(color.b).toBe(128);
		expect(color.a).toBe(255);
	});

	it('round-trips through hex', () => {
		const original = new WasmColor(42, 100, 200, 255);
		const hex = original.to_hex();
		const restored = WasmColor.from_hex(hex);
		expect(restored.r).toBe(42);
		expect(restored.g).toBe(100);
		expect(restored.b).toBe(200);
	});

	it('throws on invalid hex string', () => {
		expect(() => WasmColor.from_hex('invalid')).toThrow();
		expect(() => WasmColor.from_hex('#gg0000')).toThrow();
		expect(() => WasmColor.from_hex('#ff00')).toThrow();
	});
});
