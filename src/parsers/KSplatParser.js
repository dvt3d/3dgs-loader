import { createColumns, decodeFloat16 } from '../Util'

/* ===================== constants ===================== */

const COMPRESSION_MODES = [
  {
    centerBytes: 12,
    scaleBytes: 12,
    rotationBytes: 16,
    colorBytes: 4,
    harmonicsBytes: 4,
    scaleStartByte: 12,
    rotationStartByte: 24,
    colorStartByte: 40,
    harmonicsStartByte: 44,
    scaleQuantRange: 1,
  },
  {
    centerBytes: 6,
    scaleBytes: 6,
    rotationBytes: 8,
    colorBytes: 4,
    harmonicsBytes: 2,
    scaleStartByte: 6,
    rotationStartByte: 12,
    colorStartByte: 20,
    harmonicsStartByte: 24,
    scaleQuantRange: 32767,
  },
  {
    centerBytes: 6,
    scaleBytes: 6,
    rotationBytes: 8,
    colorBytes: 4,
    harmonicsBytes: 1,
    scaleStartByte: 6,
    rotationStartByte: 12,
    colorStartByte: 20,
    harmonicsStartByte: 24,
    scaleQuantRange: 32767,
  },
]

const HARMONICS_COMPONENT_COUNT = [0, 9, 24, 45]

const MAIN_HEADER_SIZE = 4096
const SECTION_HEADER_SIZE = 1024
const ROW_LENGTH = 3 * 4 + 3 * 4 + 4 + 4
const SH_C0 = 0.28209479177387814

/* ===================== utils ===================== */

function _packSnorm8(v) {
  return Math.max(-128, Math.min(127, Math.round(v * 127)))
}

/**
 * Scan only section headers to get max harmonics degree
 */
function _scanMaxHarmonicsDegree(data) {
  const mainHeader = new DataView(
    data.buffer,
    data.byteOffset,
    MAIN_HEADER_SIZE,
  )
  const maxSections = mainHeader.getUint32(4, true)

  let maxDegree = 0
  for (let i = 0; i < maxSections; i++) {
    const off = MAIN_HEADER_SIZE + i * SECTION_HEADER_SIZE
    const sectionHeader = new DataView(
      data.buffer,
      data.byteOffset + off,
      SECTION_HEADER_SIZE,
    )
    const count = sectionHeader.getUint32(0, true)
    if (!count) continue
    const degree = sectionHeader.getUint16(40, true)
    maxDegree = Math.max(maxDegree, degree)
  }
  return maxDegree
}

/* ===================== core decoder ===================== */

/**
 * Iterate all splats in ksplat and invoke callback
 * options: { harmonics: boolean }
 */
function _forEachKSplat(data, options, onSplat) {
  const { harmonics = true } = options

  const mainHeader = new DataView(
    data.buffer,
    data.byteOffset,
    MAIN_HEADER_SIZE,
  )

  const maxSections = mainHeader.getUint32(4, true)
  const numSplats = mainHeader.getUint32(16, true)
  const compressionMode = mainHeader.getUint16(20, true)

  if (!numSplats) throw new Error('Empty ksplat file')
  if (compressionMode > 2) {
    throw new Error(`Invalid compression mode: ${compressionMode}`)
  }

  const minHarmonicsValue = mainHeader.getFloat32(36, true) || -1.5
  const maxHarmonicsValue = mainHeader.getFloat32(40, true) || 1.5

  const mode = COMPRESSION_MODES[compressionMode]

  let globalIndex = 0
  let currentSectionDataOffset =
    MAIN_HEADER_SIZE + maxSections * SECTION_HEADER_SIZE

  for (let s = 0; s < maxSections; s++) {
    const sectionHeaderOffset = MAIN_HEADER_SIZE + s * SECTION_HEADER_SIZE
    const sectionHeader = new DataView(
      data.buffer,
      data.byteOffset + sectionHeaderOffset,
      SECTION_HEADER_SIZE,
    )

    const sectionSplatCount = sectionHeader.getUint32(0, true)
    if (!sectionSplatCount) continue

    const maxSectionSplats = sectionHeader.getUint32(4, true)
    const bucketCapacity = sectionHeader.getUint32(8, true)
    const bucketCount = sectionHeader.getUint32(12, true)
    const spatialBlockSize = sectionHeader.getFloat32(16, true)
    const bucketStorageSize = sectionHeader.getUint16(20, true)
    const quantizationRange =
      sectionHeader.getUint32(24, true) || mode.scaleQuantRange
    const fullBuckets = sectionHeader.getUint32(32, true)
    const partialBuckets = sectionHeader.getUint32(36, true)
    const harmonicsDegree = sectionHeader.getUint16(40, true)

    const harmonicsComponentCount = harmonics
      ? HARMONICS_COMPONENT_COUNT[harmonicsDegree]
      : 0

    const bytesPerSplat =
      mode.centerBytes +
      mode.scaleBytes +
      mode.rotationBytes +
      mode.colorBytes +
      harmonicsComponentCount * mode.harmonicsBytes

    const fullBucketSplats = fullBuckets * bucketCapacity
    const partialBucketMetaSize = partialBuckets * 4
    const totalBucketStorageSize =
      bucketStorageSize * bucketCount + partialBucketMetaSize

    const sectionDataSize = bytesPerSplat * maxSectionSplats
    const positionScale = spatialBlockSize / 2.0 / quantizationRange

    const bucketCentersOffset = currentSectionDataOffset + partialBucketMetaSize
    const bucketCenters = new Float32Array(
      data.buffer,
      data.byteOffset + bucketCentersOffset,
      bucketCount * 3,
    )

    const partialBucketSizes = new Uint32Array(
      data.buffer,
      data.byteOffset + currentSectionDataOffset,
      partialBuckets,
    )

    const splatDataOffset = currentSectionDataOffset + totalBucketStorageSize
    const splatData = new DataView(
      data.buffer,
      data.byteOffset + splatDataOffset,
      sectionDataSize,
    )

    const decodeHarmonics = (offset, component) => {
      switch (compressionMode) {
        case 0:
          return splatData.getFloat32(
            offset + mode.harmonicsStartByte + component * 4,
            true,
          )
        case 1:
          return decodeFloat16(
            splatData.getUint16(
              offset + mode.harmonicsStartByte + component * 2,
              true,
            ),
          )
        case 2: {
          const t =
            splatData.getUint8(offset + mode.harmonicsStartByte + component) /
            255
          return minHarmonicsValue + t * (maxHarmonicsValue - minHarmonicsValue)
        }
      }
    }

    let currentPartialBucket = fullBuckets
    let currentPartialBase = fullBucketSplats

    for (let i = 0; i < sectionSplatCount; i++) {
      const splatByteOffset = i * bytesPerSplat

      let bucketIdx
      if (i < fullBucketSplats) {
        bucketIdx = (i / bucketCapacity) | 0
      } else {
        const size = partialBucketSizes[currentPartialBucket - fullBuckets]
        if (i >= currentPartialBase + size) {
          currentPartialBase += size
          currentPartialBucket++
        }
        bucketIdx = currentPartialBucket
      }

      const readF32orF16 = (off) =>
        compressionMode === 0
          ? splatData.getFloat32(splatByteOffset + off, true)
          : decodeFloat16(splatData.getUint16(splatByteOffset + off, true))

      let x, y, z
      if (compressionMode === 0) {
        x = splatData.getFloat32(splatByteOffset, true)
        y = splatData.getFloat32(splatByteOffset + 4, true)
        z = splatData.getFloat32(splatByteOffset + 8, true)
      } else {
        x =
          (splatData.getUint16(splatByteOffset, true) - quantizationRange) *
            positionScale +
          bucketCenters[bucketIdx * 3]
        y =
          (splatData.getUint16(splatByteOffset + 2, true) - quantizationRange) *
            positionScale +
          bucketCenters[bucketIdx * 3 + 1]
        z =
          (splatData.getUint16(splatByteOffset + 4, true) - quantizationRange) *
            positionScale +
          bucketCenters[bucketIdx * 3 + 2]
      }

      const sx = readF32orF16(mode.scaleStartByte)
      const sy = readF32orF16(mode.scaleStartByte + 2)
      const sz = readF32orF16(mode.scaleStartByte + 4)

      const r0 = readF32orF16(mode.rotationStartByte)
      const r1 = readF32orF16(mode.rotationStartByte + 2)
      const r2 = readF32orF16(mode.rotationStartByte + 4)
      const r3 = readF32orF16(mode.rotationStartByte + 6)

      const c0 = splatData.getUint8(splatByteOffset + mode.colorStartByte)
      const c1 = splatData.getUint8(splatByteOffset + mode.colorStartByte + 1)
      const c2 = splatData.getUint8(splatByteOffset + mode.colorStartByte + 2)
      const c3 = splatData.getUint8(splatByteOffset + mode.colorStartByte + 3)

      onSplat(globalIndex++, {
        x,
        y,
        z,
        sx,
        sy,
        sz,
        r0,
        r1,
        r2,
        r3,
        c0,
        c1,
        c2,
        c3,
        harmonicsComponentCount,
        decodeHarmonics,
        splatByteOffset,
      })
    }
    currentSectionDataOffset += sectionDataSize + totalBucketStorageSize
  }

  return numSplats
}

/* ===================== public APIs ===================== */

/**
 * KSplat → Columns
 * options: { harmonics?: boolean }
 */
export function parseKSplatToColumns(data) {
  const mainHeader = new DataView(
    data.buffer,
    data.byteOffset,
    MAIN_HEADER_SIZE,
  )
  const numSplats = mainHeader.getUint32(16, true)
  const columns = createColumns(numSplats)
  const maxDegree = _scanMaxHarmonicsDegree(data)
  const shCount = HARMONICS_COMPONENT_COUNT[maxDegree]
  for (let i = 0; i < shCount; i++) {
    columns[`f_rest_${i}`] = new Float32Array(numSplats)
  }
  _forEachKSplat(data, { harmonics: true }, (i, s) => {
    columns['x'][i] = s.x
    columns['y'][i] = s.y
    columns['z'][i] = s.z
    columns['scale_0'][i] = s.sx > 0 ? Math.log(s.sx) : -10
    columns['scale_1'][i] = s.sy > 0 ? Math.log(s.sy) : -10
    columns['scale_2'][i] = s.sz > 0 ? Math.log(s.sz) : -10

    columns['rot_0'][i] = s.r0
    columns['rot_1'][i] = s.r1
    columns['rot_2'][i] = s.r2
    columns['rot_3'][i] = s.r3

    columns['f_dc_0'][i] = (s.c0 / 255 - 0.5) / SH_C0
    columns['f_dc_1'][i] = (s.c1 / 255 - 0.5) / SH_C0
    columns['f_dc_2'][i] = (s.c2 / 255 - 0.5) / SH_C0

    const a = Math.max(1e-6, Math.min(1 - 1e-6, s.c3 / 255))
    columns['opacity'][i] = Math.log(a / (1 - a))

    for (let k = 0; k < s.harmonicsComponentCount; k++) {
      let channel, coeff
      if (k < 9) {
        channel = (k / 3) | 0
        coeff = k % 3
      } else if (k < 24) {
        channel = ((k - 9) / 5) | 0
        coeff = ((k - 9) % 5) + 3
      } else {
        channel = ((k - 24) / 7) | 0
        coeff = ((k - 24) % 7) + 8
      }
      const col = channel * (s.harmonicsComponentCount / 3) + coeff
      columns[`f_rest_${col}`][i] = s.decodeHarmonics(s.splatByteOffset, k)
    }
  })

  return { numSplats, columns }
}

/**
 * KSplat → Splat (no SH)
 */
export function parseKSplatToSplat(data) {
  const mainHeader = new DataView(
    data.buffer,
    data.byteOffset,
    MAIN_HEADER_SIZE,
  )
  const numSplats = mainHeader.getUint32(16, true)
  const outBuffer = new ArrayBuffer(ROW_LENGTH * numSplats)
  const outF32 = new Float32Array(outBuffer)
  const outU8 = new Uint8Array(outBuffer)
  _forEachKSplat(data, { harmonics: false }, (i, s) => {
    const baseF32 = (i * ROW_LENGTH) >> 2
    const baseU8 = i * ROW_LENGTH
    outF32[baseF32 + 0] = s.x
    outF32[baseF32 + 1] = s.y
    outF32[baseF32 + 2] = s.z

    outF32[baseF32 + 3] = s.sx > 0 ? Math.log(s.sx) : -10
    outF32[baseF32 + 4] = s.sy > 0 ? Math.log(s.sy) : -10
    outF32[baseF32 + 5] = s.sz > 0 ? Math.log(s.sz) : -10

    outU8[baseU8 + 24] = s.c0
    outU8[baseU8 + 25] = s.c1
    outU8[baseU8 + 26] = s.c2
    outU8[baseU8 + 27] = s.c3

    outU8[baseU8 + 28] = _packSnorm8(s.r0) & 0xff
    outU8[baseU8 + 29] = _packSnorm8(s.r1) & 0xff
    outU8[baseU8 + 30] = _packSnorm8(s.r2) & 0xff
    outU8[baseU8 + 31] = _packSnorm8(s.r3) & 0xff
  })
  return { buffer: outBuffer, numSplats }
}
