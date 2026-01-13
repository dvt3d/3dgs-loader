import { createColumns } from '../Util'

const SH_C0_2 = 0.15
const HARMONICS_COMPONENT_COUNT = [0, 9, 24, 45]
const MAGIC_NGSP = 0x5053474e
const HEADER_SIZE = 16
const ROW_LENGTH = 3 * 4 + 3 * 4 + 4 + 4
const SH_C0 = 0.28209479177387814
const C_MASK = (1 << 9) - 1 // 511

/**
 *
 * @param data
 * @returns {Promise<Uint8Array<ArrayBuffer>>}
 * @private
 */
async function _decompressGZIP(data) {
  const blob = new Blob([data], { type: 'application/gzip' })
  const ds = new DecompressionStream('gzip')
  const decompressed = blob.stream().pipeThrough(ds)
  const ab = await new Response(decompressed).arrayBuffer()
  return new Uint8Array(ab)
}

/**
 *
 * @param u8
 * @returns {number}
 * @private
 */
function _decodeSH0FromU8(u8) {
  return (u8 / 255.0 - 0.5) / SH_C0_2
}

/**
 *
 * @param positionsView
 * @param elementIndex
 * @param memberIndex
 * @returns {number}
 * @private
 */
function _getFixed24(positionsView, elementIndex, memberIndex) {
  const sizeofMember = 3 // 24 bits is 3 bytes
  const stride = 3 * sizeofMember // x y z
  const offset = elementIndex * stride + memberIndex * sizeofMember
  let fixed32 = positionsView.getUint8(offset + 0)
  fixed32 |= positionsView.getUint8(offset + 1) << 8
  fixed32 |= positionsView.getUint8(offset + 2) << 16
  fixed32 |= fixed32 & 0x800000 ? 0xff000000 : 0 // sign extension
  return fixed32
}

/**
 *
 * @param r
 * @param flipQ
 * @returns {Float32Array<ArrayBuffer>}
 * @private
 */
function _unpackQuaternionSmallestThree(r, flipQ = [1, 1, 1]) {
  let comp = r[0] | (r[1] << 8) | (r[2] << 16) | (r[3] << 24)
  const iLargest = comp >>> 30
  const rotation = new Float32Array(4)
  let sumSquares = 0.0
  for (let i = 3; i >= 0; --i) {
    if (i !== iLargest) {
      const mag = comp & C_MASK // 9 bits
      const negbit = (comp >> 9) & 0x1 // sign bit
      comp >>>= 10
      let v = Math.SQRT1_2 * (mag / C_MASK)
      if (negbit === 1) v = -v
      rotation[i] = v
      sumSquares += v * v
    }
  }
  rotation[iLargest] = Math.sqrt(Math.max(0.0, 1.0 - sumSquares))
  rotation[0] *= flipQ[0]
  rotation[1] *= flipQ[1]
  rotation[2] *= flipQ[2]
  return rotation
}

/**
 *
 * @param data
 * @returns {Promise<{numSplats: number, columns: *, version: number, shDegree: number, fractionalBits: number}>}
 * @private
 */
export async function parseSpzToColumns(data) {
  let spzData = null
  if (data.byteLength >= 2) {
    const u16 = (data[0] << 8) | data[1]
    if (u16 === 0x1f8b) {
      spzData = await _decompressGZIP(data)
    }
  }
  if (spzData.byteLength < HEADER_SIZE) {
    throw new Error('File too small to be valid .spz')
  }
  const dv = new DataView(
    spzData.buffer,
    spzData.byteOffset,
    spzData.byteLength,
  )

  // --------------------------------------------------
  // header
  // --------------------------------------------------
  if (dv.getUint32(0, true) !== MAGIC_NGSP) {
    throw new Error('invalid file header')
  }

  const version = dv.getUint32(4, true)

  if (version !== 2 && version !== 3) {
    throw new Error(`Unsupported version ${version}`)
  }

  const numSplats = dv.getUint32(8, true)
  const shDegree = dv.getUint8(12)
  const fractionalBits = dv.getUint8(13)
  const unused_flags = dv.getUint8(14)
  const unused_reserved = dv.getUint8(15)

  const positionsByteSize = numSplats * 3 * 3 // 3 * 24bit values
  const alphasByteSize = numSplats // u8
  const colorsByteSize = numSplats * 3 // u8 * 3
  const scalesByteSize = numSplats * 3 // u8 * 3
  const rotationsByteSize = numSplats * (version === 3 ? 4 : 3)

  const harmonicsComponentCount = HARMONICS_COMPONENT_COUNT[shDegree]
  const shByteSize = numSplats * harmonicsComponentCount

  let offset = HEADER_SIZE

  const positionsView = new DataView(
    spzData.buffer,
    dv.byteOffset + offset,
    positionsByteSize,
  )
  offset += positionsByteSize

  const alphasView = new DataView(
    spzData.buffer,
    dv.byteOffset + offset,
    alphasByteSize,
  )

  offset += alphasByteSize

  const colorsView = new DataView(
    spzData.buffer,
    dv.byteOffset + offset,
    colorsByteSize,
  )
  offset += colorsByteSize
  const scalesView = new DataView(
    spzData.buffer,
    dv.byteOffset + offset,
    scalesByteSize,
  )
  offset += scalesByteSize
  const rotationsView = new DataView(
    spzData.buffer,
    dv.byteOffset + offset,
    rotationsByteSize,
  )
  offset += rotationsByteSize
  const shView = new DataView(
    spzData.buffer,
    dv.byteOffset + offset,
    shByteSize,
  )

  // Create columns for the standard Gaussian splat data
  const columns = createColumns(numSplats)

  // Add spherical harmonics columns based on maximum degree found
  for (let i = 0; i < harmonicsComponentCount; i++) {
    columns[`f_rest_${i}`] = new Float32Array(numSplats)
  }

  const scale = 1.0 / (1 << fractionalBits)

  for (let i = 0; i < numSplats; i++) {
    // Read position (3 × uint24)
    const x = _getFixed24(positionsView, i, 0) * scale
    const y = _getFixed24(positionsView, i, 1) * scale
    const z = _getFixed24(positionsView, i, 2) * scale
    // Read scale (3 × uint8 log encoded)
    const scaleX = scalesView.getUint8(i * 3 + 0) / 16.0 - 10.0
    const scaleY = scalesView.getUint8(i * 3 + 1) / 16.0 - 10.0
    const scaleZ = scalesView.getUint8(i * 3 + 2) / 16.0 - 10.0
    // Read color and opacity (4 × uint8)
    const red = colorsView.getUint8(i * 3 + 0)
    const green = colorsView.getUint8(i * 3 + 1)
    const blue = colorsView.getUint8(i * 3 + 2)
    const opacity = alphasView.getUint8(i)
    // Read rotation quaternion (4 × uint8 )
    const rotation = [0.0, 0.0, 0.0, 0.0]
    if (version === 2) {
      const base = i * 3
      const rx = rotationsView.getUint8(base + 0) / 127.5 - 1.0
      const ry = rotationsView.getUint8(base + 1) / 127.5 - 1.0
      const rz = rotationsView.getUint8(base + 2) / 127.5 - 1.0
      const rw = Math.sqrt(Math.max(0.0, 1.0 - (rx * rx + ry * ry + rz * rz)))
      rotation[0] = rw
      rotation[1] = rx
      rotation[2] = ry
      rotation[3] = rz
    } else if (version === 3) {
      const base = i * 4
      const packed = new Uint8Array(4)
      packed[0] = rotationsView.getUint8(base + 0)
      packed[1] = rotationsView.getUint8(base + 1)
      packed[2] = rotationsView.getUint8(base + 2)
      packed[3] = rotationsView.getUint8(base + 3)
      const q = _unpackQuaternionSmallestThree(packed)
      rotation[0] = q[0]
      rotation[1] = q[1]
      rotation[2] = q[2]
      rotation[3] = q[3]
    }

    // Store position
    columns['x'][i] = x
    columns['y'][i] = y
    columns['z'][i] = z

    // Store scale (No need to apply log since they are already log-encoded)
    columns['scale_0'][i] = scaleX
    columns['scale_1'][i] = scaleY
    columns['scale_2'][i] = scaleZ

    // Store color (convert from uint8 back to spherical harmonics)
    // Colors are already between 0 and 255 but multiplied by SH_C0_2. We need to revert the function to apply the correct SH_C0
    columns['f_dc_0'][i] = _decodeSH0FromU8(red)
    columns['f_dc_1'][i] = _decodeSH0FromU8(green)
    columns['f_dc_2'][i] = _decodeSH0FromU8(blue)

    // Store opacity (convert from uint8 to float and apply inverse sigmoid)
    const epsilon = 1e-6
    const normalizedOpacity = Math.max(
      epsilon,
      Math.min(1.0 - epsilon, opacity / 255.0),
    )
    columns['opacity'][i] = Math.log(
      normalizedOpacity / (1.0 - normalizedOpacity),
    )

    // Store rotation quaternion (convert from uint8 [0,255] to float [-1,1])
    columns['rot_0'][i] = rotation[0]
    columns['rot_1'][i] = rotation[1]
    columns['rot_2'][i] = rotation[2]
    columns['rot_3'][i] = rotation[3]

    for (let i = 0; i < harmonicsComponentCount; i++) {
      const channel = i % 3
      const coeff = Math.floor(i / 3)
      const col = channel * (harmonicsComponentCount / 3) + coeff
      const shCoef = shView.getUint8(i * harmonicsComponentCount + i)
      columns[`f_rest_${col}`][i] = (shCoef - 128) / 128
    }
  }
  return {
    numSplats,
    columns,
    version,
    shDegree,
    fractionalBits,
  }
}

/**
 *
 * @param data
 * @returns {Promise<{numSplats: number, buffer: ArrayBuffer}>}
 */
export async function parseSpzToSplat(data) {
  let spzData = null
  if (data.byteLength >= 2) {
    const u16 = (data[0] << 8) | data[1]
    if (u16 === 0x1f8b) {
      spzData = await _decompressGZIP(data)
    }
  }
  if (spzData.byteLength < HEADER_SIZE) {
    throw new Error('File too small to be valid .spz')
  }
  const dv = new DataView(
    spzData.buffer,
    spzData.byteOffset,
    spzData.byteLength,
  )
  // header
  if (dv.getUint32(0, true) !== MAGIC_NGSP) {
    throw new Error('invalid file header')
  }
  const version = dv.getUint32(4, true)
  if (version !== 2 && version !== 3) {
    throw new Error(`Unsupported version ${version}`)
  }
  const numSplats = dv.getUint32(8, true)
  const fractionalBits = dv.getUint8(13)
  const positionsByteSize = numSplats * 3 * 3
  const alphasByteSize = numSplats
  const colorsByteSize = numSplats * 3
  const scalesByteSize = numSplats * 3
  const rotationsByteSize = numSplats * (version === 3 ? 4 : 3)
  let offset = HEADER_SIZE
  const positionsView = new DataView(
    spzData.buffer,
    dv.byteOffset + offset,
    positionsByteSize,
  )
  offset += positionsByteSize
  const alphasView = new Uint8Array(
    spzData.buffer,
    dv.byteOffset + offset,
    alphasByteSize,
  )
  offset += alphasByteSize
  const colorsView = new Uint8Array(
    spzData.buffer,
    dv.byteOffset + offset,
    colorsByteSize,
  )
  offset += colorsByteSize
  const scalesView = new Uint8Array(
    spzData.buffer,
    dv.byteOffset + offset,
    scalesByteSize,
  )
  offset += scalesByteSize
  const rotationsView = new Uint8Array(
    spzData.buffer,
    dv.byteOffset + offset,
    rotationsByteSize,
  )
  /* ---------- output buffer ---------- */
  const outBuffer = new ArrayBuffer(ROW_LENGTH * numSplats)
  const outF32 = new Float32Array(outBuffer)
  const outU8 = new Uint8Array(outBuffer)
  const scale = 1.0 / (1 << fractionalBits)
  const epsilon = 1e-6

  for (let i = 0; i < numSplats; i++) {
    const baseF32 = (i * ROW_LENGTH) >> 2
    const baseU8 = i * ROW_LENGTH

    // position
    outF32[baseF32 + 0] = _getFixed24(positionsView, i, 0) * scale
    outF32[baseF32 + 1] = _getFixed24(positionsView, i, 1) * scale
    outF32[baseF32 + 2] = _getFixed24(positionsView, i, 2) * scale

    //scale
    outF32[baseF32 + 3] = Math.exp(scalesView[i * 3 + 0] / 16.0 - 10.0)
    outF32[baseF32 + 4] = Math.exp(scalesView[i * 3 + 1] / 16.0 - 10.0)
    outF32[baseF32 + 5] = Math.exp(scalesView[i * 3 + 2] / 16.0 - 10.0)

    // Read color and opacity (4 × uint8)
    outU8[baseU8 + 24] =
      (0.5 + SH_C0 * _decodeSH0FromU8(colorsView[i * 3 + 0])) * 255
    outU8[baseU8 + 25] =
      (0.5 + SH_C0 * _decodeSH0FromU8(colorsView[i * 3 + 1])) * 255
    outU8[baseU8 + 26] =
      (0.5 + SH_C0 * _decodeSH0FromU8(colorsView[i * 3 + 2])) * 255

    /* ---------- opacity ---------- */
    const opacity = Math.max(
      epsilon,
      Math.min(1.0 - epsilon, alphasView[i] / 255.0),
    )
    outU8[baseU8 + 27] =
      (1 / (1 + Math.exp(-Math.log(opacity / (1 - opacity))))) * 255

    // rotation
    let q0, q1, q2, q3
    if (version === 2) {
      const base = i * 3
      q1 = rotationsView[base + 0] / 127.5 - 1.0
      q2 = rotationsView[base + 1] / 127.5 - 1.0
      q3 = rotationsView[base + 2] / 127.5 - 1.0
      q0 = Math.sqrt(Math.max(0.0, 1.0 - (q1 * q1 + q2 * q2 + q3 * q3)))
    } else if (version === 3) {
      const base = i * 4
      ;[q0, q1, q2, q3] = _unpackQuaternionSmallestThree(
        rotationsView.subarray(base, base + 4),
      )
    }
    const invLen = 1 / Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3)
    outU8[baseU8 + 28] = q0 * invLen * 128 + 128
    outU8[baseU8 + 29] = q1 * invLen * 128 + 128
    outU8[baseU8 + 30] = q2 * invLen * 128 + 128
    outU8[baseU8 + 31] = q3 * invLen * 128 + 128
  }
  return {
    numSplats,
    buffer: outBuffer,
  }
}
