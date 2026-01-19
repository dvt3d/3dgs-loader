# 3DGS Loader 

This module provides a **unified loader framework for 3D Gaussian Splatting (3DGS)** data.
It supports multiple data formats and exposes a **consistent usage API**, independent of the underlying format.

The loader layer is responsible **only for data loading and parsing**.
It does not handle rendering, sorting, LOD, or interaction logic.


## 1. Loader Overview

All loaders inherit from a shared base class `Loader` and follow the same public API.

Supported loaders include:

- `SplatLoader` (`.splat`)
- `SogLoader` (`.sog` / `.json`)
- `SpzLoader` （`.spz`）
- `KSplatLoader` (`.ksplat`)
- `PlyLoader` (`.ply`)

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
> `SplatLoader` is a special case:  
> it **only provides `load()` and `loadColumns()`**, and does **not** implement  
> `loadAsSplat()` or `parseAsSplat()`, because the `.splat` format is already the
> native splat representation.

---

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

---

### 2.3 Parse as Columns (From Existing Buffer)

```js
const columns = await loader.parseColumns(dataBuffer)
```

- Parses an already loaded binary buffer
- Skips network requests
- Useful for custom I/O or streaming systems

---

### 2.4 Load as Splat

```js
const splat = await loader.loadAsSplat('scene.sog', {
  onProgress: (percent) => {
    console.log(`loading: ${percent}`)
  },
})
```

- Loads a 3DGS source and parses it directly into **Splat format**
- Skips the column-based representation
- Useful for exporting, legacy pipelines, or direct splat-based workflows
- **Not supported by `SplatLoader`**

---

### 2.5 Parse as Splat (From Existing Buffer)

```js
const splat = await loader.parseAsSplat(dataBuffer)
```

- Parses raw data directly into Splat format
- Suitable when data is already available in memory
- **Not supported by `SplatLoader`**

---

### 2.6 Dispose the Loader

```js
loader.dispose()
```

Always dispose the loader when it is no longer needed to properly release worker and memory resources.


## 3. Worker Acceleration (Optional)

All loaders support worker-based parsing through `WorkerPool`.

```js
const loader = new SogLoader({
  workerLimit: 6,   // Enable worker-based parsing
})

```
- Parsing runs off the main thread

- ArrayBuffers are transferred (zero-copy)

- Fully transparent to the calling code

