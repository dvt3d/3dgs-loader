const magicBytes = new Uint8Array([112, 108, 121, 10])
const endHeaderBytes = new Uint8Array([
  10, 101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10,
])

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
  let headerSize = magicBytes.length
  while (headerSize < data.size) {
    if (_compare(data, endHeaderBytes, headerSize - endHeaderBytes.length))
      break
    headerSize++
  }
  const header = _parseHeader(data.subarray(0, headerSize))
  const body = data.subarray(headerSize)
  let cursor = 0
  const element = {}
  for (const el of header.elements) {
    const columns = {}
    const sizes = []
    for (const prop of el.properties) {
      const T = _getDataType(prop.type)
      columns[prop.name] = new T(el.count)
      sizes.push(columns[prop.name].BYTES_PER_ELEMENT)
    }
    const rowSize = sizes.reduce((a, b) => a + b, 0)
    for (let i = 0; i < el.count; i++) {
      let offset = 0
      for (const prop of el.properties) {
        const arr = columns[prop.name]
        const s = arr.BYTES_PER_ELEMENT
        body.copy(
          new Uint8Array(arr.buffer),
          i * s,
          cursor + offset,
          cursor + offset + s,
        )
        offset += s
      }
      cursor += rowSize
    }
    element[el.name] = { numSplats: el.count, columns }
  }
  return element['vertex']
}
