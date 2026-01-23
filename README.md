# 3DGS Loader

This module provides a **unified loader framework for 3D Gaussian Splatting (3DGS)** data.
It supports multiple data formats and exposes a **consistent usage API**, independent of the underlying format.

The loader layer is responsible **only for data loading and parsing**.
It does not handle rendering, sorting, LOD, or interaction logic.

## 1. Loader Overview

All loaders inherit from a shared base class `Loader` and follow the same public API.

Supported loaders include:

- `SplatLoader` (`.splat`)
- `SogLoader` (`.sog` , `.json` , `ArrayBuffer` )
- `SpzLoader` （`.spz` , `ArrayBuffer`）
- `KSplatLoader` (`.ksplat` , `ArrayBuffer`)
- `PlyLoader` (`.ply` , `ArrayBuffer`)

Because the interface is uniform, loaders can be swapped without changing application code.

## 2. Basic Usage (Common to All Loaders)

### 2.1 Create a Loader

```js
import SplatLoader from './loaders/SplatLoader'

const loader = new SplatLoader({
    workerLimit: 4,        // Number of workers (0 = disabled)
    workerBaseUrl: './',   // Base URL for worker scripts
    wasmBaseUrl: './',     // Base URL for WASM assets (if required)
})
```

All loader types accept the same constructor options.

> **Note**
>
> `SplatLoader` is a special case: it **only provides `load()` and `loadColumns()`**, and does **not** implement
`loadAsSplat()` or `parseAsSplat()`, because the `.splat` format is already the native splat representation.

### 2.2 Load as Columns

```js
const columns = await loader.loadColumns('scene.splat', {
    onProgress: (percent) => {
        console.log(`loading: ${percent}`)
    },
})
```

- Loads a 3DGS source and parses it into **column-based data**
- Recommended entry point for most pipelines
- Suitable for any downstream 3DGS workflow

### 2.3 Parse as Columns (From Existing Buffer)

```js
const columns = await loader.parseColumns(dataBuffer)
```

- Parses an already loaded binary buffer
- Skips network requests
- Useful for custom I/O or streaming systems

### 2.4 Load as Splat

```js
const splat = await loader.loadAsSplat('***.ply', {
    onProgress: (percent) => {
        console.log(`loading: ${percent}`)
    },
})
```

- Loads a 3DGS source and parses it directly into **Splat format**
- Skips the column-based representation
- Useful for exporting, legacy pipelines, or direct splat-based workflows
- **Not supported by `SplatLoader`**

### 2.5 Parse as Splat (From Existing Buffer)

```js
const splat = await loader.parseAsSplat(dataBuffer)
```

- Parses raw data directly into Splat format
- Suitable when data is already available in memory
- **Not supported by `SplatLoader`**

### 2.6 Load as Attributes

```js
const attributes = await loader.loadAsAttributes('***.ply', {
    onProgress: (percent) => {
        console.log(`loading: ${percent}`)
    },
})
```

- Loads a 3DGS source and parses it directly into **Attributes format**
- Produces typed arrays:
    - `positions: Float32Array`
    - `scales: Float32Array`
    - `rotations: Float32Array`
    - `colors: Uint8Array`

---

### 2.7 Parse as Attributes (From Existing Buffer)

```js
const attributes = await loader.parseAsAttributes(dataBuffer)
```

- Parses raw data already available in memory into **Attributes format**

#### Attributes Format Definition

```js
interface
GaussianSplatAttributes
{
    numSplats: number
    positions: Float32Array   // xyz, length = numSplats * 3
    scales: Float32Array      // sx sy sz (linear), length = numSplats * 3
    rotations: Float32Array   // quaternion xyzw, length = numSplats * 4
    colors: Uint8Array        // rgba, length = numSplats * 4
}
```

### 2.8 Dispose the Loader

```js
loader.dispose()
```

Always dispose the loader when it is no longer needed to properly release worker and memory resources.

## 3. Worker Acceleration (Optional)

All loaders support worker-based parsing through `WorkerPool`, allowing heavy decoding
and parsing work to run off the main thread.

### 3.1 Enable Worker Acceleration

```js
const loader = new SogLoader({
    workerLimit: 4,   // Enable worker-based parsing
})
```

- Parsing runs entirely off the main thread
- ArrayBuffers are transferred to workers (zero-copy)
- Fully transparent to the calling code

## 4. WASM Support (Optional)

Some loaders (notably **`SogLoader`**) rely on **WebAssembly (WASM)** modules for
decoding compressed data, such as **WebP-encoded spherical harmonics**.

### 4.1 When WASM Is Required

- SOG data may store SH coefficients in WebP format
- Decoding WebP efficiently requires a WASM-based decoder
- The WASM module is **not bundled** with the loader by default

### 4.2 Required WASM Assets

The following files must be available at runtime:

```text
/webp/
├─ wasm_webp.wasm
└─ wasm_webp.min.js
```

These files must be copied to a publicly accessible location.

### 4.3 Configure WASM Path

```js
const loader = new SogLoader({
    workerLimit: 4,
    wasmBaseUrl: './',   // Base URL that contains the /webp directory
})
```

The loader resolves the WebP WASM script URL internally and passes it to the worker
or main-thread parser as needed.
