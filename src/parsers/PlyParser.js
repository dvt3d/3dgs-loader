const magicBytes = new Uint8Array([112, 108, 121, 10])
const endHeaderBytes = new Uint8Array([
  10, 101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10,
])

const ROW_LENGTH = 3 * 4 + 3 * 4 + 4 + 4
const SH_C0 = 0.28209479177387814

const TYPE_MAP = {
  double: 'getFloat64',
  int: 'getInt32',
  uint: 'getUint32',
  float: 'getFloat32',
  short: 'getInt16',
  ushort: 'getUint16',
  uchar: 'getUint8',
}

/**
 *
 * @param type
 * @returns {Int16ArrayConstructor|Float64ArrayConstructor|Int8ArrayConstructor|Uint8ArrayConstructor|Uint16ArrayConstructor|null|Int32ArrayConstructor|Float32ArrayConstructor|Uint32ArrayConstructor}
 * @private
 */
function _getDataType(type) {
  switch (type) {
    case 'char':
      return Int8Array
    case 'uchar':
      return Uint8Array
    case 'short':
      return Int16Array
    case 'ushort':
      return Uint16Array
    case 'int':
      return Int32Array
    case 'uint':
      return Uint32Array
    case 'float':
      return Float32Array
    case 'double':
      return Float64Array
    default:
      return null
  }
}

/**
 *
 * @param data
 * @returns {{comments: *[], elements: *[]}}
 * @private
 */
function _parseHeader(data) {
  const strings = new TextDecoder('ascii')
    .decode(data)
    .split('\n')
    .filter((line) => line)
  const elements = []
  const comments = []
  let element
  for (let i = 1; i < strings.length; ++i) {
    const words = strings[i].split(' ')
    switch (words[0]) {
      case 'ply':
      case 'format':
      case 'end_header':
        break
      case 'comment':
        comments.push(strings[i].substring(8)) // skip 'comment '
        break
      case 'element': {
        if (words.length !== 3) {
          throw new Error('invalid ply header')
        }
        element = {
          name: words[1],
          count: parseInt(words[2], 10),
          properties: [],
        }
        elements.push(element)
        break
      }
      case 'property': {
        if (!element || words.length !== 3 || !_getDataType(words[1])) {
          throw new Error('invalid ply header')
        }
        element.properties.push({
          name: words[2],
          type: words[1],
        })
        break
      }
      default: {
        throw new Error(`unrecognized header value '${words[0]}' in ply header`)
      }
    }
  }
  return { comments, elements }
}

/**
 *
 * @param a
 * @param b
 * @param aOffset
 * @returns {boolean}
 * @private
 */
function _compare(a, b, aOffset = 0) {
  for (let i = 0; i < b.length; ++i) {
    if (a[aOffset + i] !== b[i]) {
      return false
    }
  }
  return true
}

/**
 *
 * @param data
 * @returns {*}
 */
export function parsePlyToColumns(data) {
  if (!_compare(data, magicBytes)) {
    throw new Error('not a ply file')
  }
  /* ---------- scan header ---------- */
  let headerSize = magicBytes.length
  while (headerSize < data.length) {
    if (_compare(data, endHeaderBytes, headerSize - endHeaderBytes.length)) {
      break
    }
    headerSize++
  }
  const header = _parseHeader(data.subarray(0, headerSize))
  const body = data.subarray(headerSize)
  let cursor = 0
  const elements = {}
  for (const el of header.elements) {
    const columns = {}
    const props = []
    for (const prop of el.properties) {
      const T = _getDataType(prop.type)
      const arr = new T(el.count)
      columns[prop.name] = arr
      props.push({
        name: prop.name,
        bytes: arr.BYTES_PER_ELEMENT,
        view: new Uint8Array(arr.buffer),
      })
    }
    const rowSize = props.reduce((s, p) => s + p.bytes, 0)
    for (let i = 0; i < el.count; i++) {
      let offset = 0
      for (const p of props) {
        const srcStart = cursor + offset
        const srcEnd = srcStart + p.bytes
        p.view.set(body.subarray(srcStart, srcEnd), i * p.bytes)
        offset += p.bytes
      }
      cursor += rowSize
    }
    elements[el.name] = {
      numSplats: el.count,
      columns,
    }
  }
  return elements['vertex']
}

/**
 * Parse binary PLY and output splat ArrayBuffer
 * @param {Uint8Array} data
 * @returns {{ buffer: ArrayBuffer, numSplats: number }}
 */
export function parsePlyToSplat(data) {
  if (!_compare(data, magicBytes)) {
    throw new Error('not a ply file')
  }
  /* ---------- scan header ---------- */
  let headerSize = magicBytes.length
  while (headerSize < data.length) {
    if (_compare(data, endHeaderBytes, headerSize - endHeaderBytes.length)) {
      break
    }
    headerSize++
  }
  const plyHeader = _parseHeader(data.subarray(0, headerSize))

  const vertex = plyHeader.elements.find((e) => e.name === 'vertex')
  if (!vertex) {
    throw new Error('PLY has no vertex element')
  }

  let rowStride = 0
  const offsets = {}
  const types = {}
  for (const prop of vertex.properties) {
    const T = _getDataType(prop.type)
    offsets[prop.name] = rowStride
    types[prop.name] = TYPE_MAP[prop.type]
    rowStride += T.BYTES_PER_ELEMENT
  }

  const numSplats = vertex.count

  /* ---------- data view ---------- */
  const bodyOffset = data.byteOffset + headerSize
  const dv = new DataView(data.buffer, bodyOffset, numSplats * rowStride)

  const getAttr = (row, name) => {
    const fn = types[name]
    if (!fn) return undefined
    return dv[fn](row * rowStride + offsets[name], true)
  }

  /* ---------- output buffer ---------- */
  const outBuffer = new ArrayBuffer(ROW_LENGTH * numSplats)
  const outF32 = new Float32Array(outBuffer)
  const outU8 = new Uint8Array(outBuffer)

  const hasScale = 'scale_0' in types
  const hasColorSH = 'f_dc_0' in types
  const hasOpacity = 'opacity' in types

  for (let i = 0; i < numSplats; i++) {
    const baseF32 = (i * ROW_LENGTH) >> 2
    const baseU8 = i * ROW_LENGTH
    // position
    outF32[baseF32 + 0] = getAttr(i, 'x')
    outF32[baseF32 + 1] = getAttr(i, 'y')
    outF32[baseF32 + 2] = getAttr(i, 'z')

    if (hasScale) {
      const s0 = getAttr(i, 'scale_0')
      const s1 = getAttr(i, 'scale_1')
      const s2 = getAttr(i, 'scale_2')
      const q0 = getAttr(i, 'rot_0')
      const q1 = getAttr(i, 'rot_1')
      const q2 = getAttr(i, 'rot_2')
      const q3 = getAttr(i, 'rot_3')
      outF32[baseF32 + 3] = Math.exp(s0)
      outF32[baseF32 + 4] = Math.exp(s1)
      outF32[baseF32 + 5] = Math.exp(s2)
      const invLen = 1 / Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3)
      outU8[baseU8 + 28] = q0 * invLen * 128 + 128
      outU8[baseU8 + 29] = q1 * invLen * 128 + 128
      outU8[baseU8 + 30] = q2 * invLen * 128 + 128
      outU8[baseU8 + 31] = q3 * invLen * 128 + 128
    } else {
      outF32[baseF32 + 3] = outF32[baseF32 + 4] = outF32[baseF32 + 5] = 0.01
      outU8[baseU8 + 28] = 255
    }

    // color
    if (hasColorSH) {
      outU8[baseU8 + 24] = (0.5 + SH_C0 * getAttr(i, 'f_dc_0')) * 255
      outU8[baseU8 + 25] = (0.5 + SH_C0 * getAttr(i, 'f_dc_1')) * 255
      outU8[baseU8 + 26] = (0.5 + SH_C0 * getAttr(i, 'f_dc_2')) * 255
    } else {
      outU8[baseU8 + 24] = getAttr(i, 'red')
      outU8[baseU8 + 25] = getAttr(i, 'green')
      outU8[baseU8 + 26] = getAttr(i, 'blue')
    }

    // alpha
    outU8[baseU8 + 27] = hasOpacity
      ? (1 / (1 + Math.exp(-getAttr(i, 'opacity')))) * 255
      : 255
  }

  return { buffer: outBuffer, numSplats }
}
