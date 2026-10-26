import { copyFile, mkdir } from 'node:fs/promises';

// MapLibre v6 ESM workers resolve the shared module beside the worker file.
const source = new URL('../node_modules/maplibre-gl/dist/', import.meta.url);
const destination = new URL('../public/maplibre/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(new URL(file, source), new URL(file, destination));
}
await copyFile(new URL('../node_modules/maplibre-gl/LICENSE.txt', import.meta.url), new URL('LICENSE.txt', destination));
