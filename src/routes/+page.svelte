<script lang="ts">
  import { onMount } from 'svelte';

  let addResult = $state<number | null>(null);
  let greetResult = $state<string | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const wasm = await import('$wasm/dotorixel_wasm.js');
      await wasm.default();
      addResult = wasm.add(2, 3);
      greetResult = wasm.greet('dotorixel');
      isLoading = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load WASM module';
      isLoading = false;
    }
  });
</script>

<main>
  <h1>DOTORIXEL</h1>
  <p>Build pipeline verification</p>

  {#if isLoading}
    <p>Loading WASM module...</p>
  {:else if error}
    <p>Error: {error}</p>
  {:else}
    <section>
      <h2>WASM Results</h2>
      <p>add(2, 3) = {addResult}</p>
      <p>greet("dotorixel") = {greetResult}</p>
    </section>
  {/if}
</main>
