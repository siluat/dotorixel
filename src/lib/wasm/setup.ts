import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initSync } from '$wasm/dotorixel_wasm';

const wasmPath = join(process.cwd(), 'wasm/pkg/dotorixel_wasm_bg.wasm');
const wasmBytes = readFileSync(wasmPath);
initSync({ module: wasmBytes });
