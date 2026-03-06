<script lang="ts">
  async function loadWasm() {
    const wasm = await import('$wasm/dotorixel_wasm.js');
    await wasm.default();
    return { add: wasm.add(2, 3), greet: wasm.greet('dotorixel') };
  }

  const wasmReady = loadWasm();
</script>

<main>
  <h1>DOTORIXEL</h1>
  <p>Build pipeline verification</p>

  {#await wasmReady}
    <p>Loading WASM module...</p>
  {:then results}
    <section>
      <h2>WASM Results</h2>
      <p>add(2, 3) = {results.add}</p>
      <p>greet("dotorixel") = {results.greet}</p>
    </section>
  {:catch error}
    <p>Error: {error.message}</p>
  {/await}
</main>
