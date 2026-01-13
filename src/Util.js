/**
 *
 * @param url
 * @param onProgress
 * @returns {Promise<unknown>}
 */
export function requestData(url, onProgress = null) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(url)
      const reader = res.body.getReader()
      const total = Number(res.headers.get('Content-Length')) || 0

      let received = 0
      const chunks = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        received += value.length

        if (total) {
          onProgress?.(received / total)
        }
      }
      const data = new Uint8Array(received)
      let offset = 0
      for (const c of chunks) {
        data.set(c, offset)
        offset += c.length
      }
      resolve(data)
    } catch (e) {
      reject(e)
    }
  })
}

/**
 *
 * @param url
 * @param onProgress
 * @returns {Promise<unknown>}
 */
export async function requestJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`)
  }
  return await res.json()
}

/**
 *
 * @param numSplats
 * @returns {{x: Float32Array<ArrayBuffer>, y: Float32Array<ArrayBuffer>, z: Float32Array<ArrayBuffer>, scale_0: Float32Array<ArrayBuffer>, scale_1: Float32Array<ArrayBuffer>, scale_2: Float32Array<ArrayBuffer>, f_dc_0: Float32Array<ArrayBuffer>, f_dc_1: Float32Array<ArrayBuffer>, f_dc_2: Float32Array<ArrayBuffer>, opacity: Float32Array<ArrayBuffer>, rot_0: Float32Array<ArrayBuffer>, rot_1: Float32Array<ArrayBuffer>, rot_2: Float32Array<ArrayBuffer>, rot_3: Float32Array<ArrayBuffer>}}
 */
export function createColumns(numSplats) {
  return {
    x: new Float32Array(numSplats),
    y: new Float32Array(numSplats),
    z: new Float32Array(numSplats),
    scale_0: new Float32Array(numSplats),
    scale_1: new Float32Array(numSplats),
    scale_2: new Float32Array(numSplats),
    f_dc_0: new Float32Array(numSplats),
    f_dc_1: new Float32Array(numSplats),
    f_dc_2: new Float32Array(numSplats),
    opacity: new Float32Array(numSplats),
    rot_0: new Float32Array(numSplats),
    rot_1: new Float32Array(numSplats),
    rot_2: new Float32Array(numSplats),
    rot_3: new Float32Array(numSplats),
  }
}

/**
 * Inverse of logTransform(x) = sign(x) * ln(|x| + 1)
 * @param v
 * @returns {number}
 */
export function invLogTransform(v) {
  const a = Math.abs(v)
  const e = Math.exp(a) - 1 // |x|
  return v < 0 ? -e : e
}

/**
 *
 * @param y
 * @returns {number}
 */
export function sigmoidInv(y) {
  const e = Math.min(1 - 1e-6, Math.max(1e-6, y))
  return Math.log(e / (1 - e))
}

/**
 *
 * @param url
 * @returns {string}
 */
export function stripUrlParams(url) {
  const u = new URL(url, location.href)
  u.search = ''
  u.hash = ''
  return u.toString()
}

/**
 *
 * @param encoded
 * @returns {number|number}
 */
export function decodeFloat16(encoded) {
  const signBit = (encoded >> 15) & 1
  const exponent = (encoded >> 10) & 0x1f
  const mantissa = encoded & 0x3ff
  if (exponent === 0) {
    if (mantissa === 0) {
      return signBit ? -0.0 : 0.0
    }
    // Denormalized number
    let m = mantissa
    let exp = -14
    while (!(m & 0x400)) {
      m <<= 1
      exp--
    }
    m &= 0x3ff
    const finalExp = exp + 127
    const finalMantissa = m << 13
    const bits = (signBit << 31) | (finalExp << 23) | finalMantissa
    return new Float32Array(new Uint32Array([bits]).buffer)[0]
  }
  if (exponent === 0x1f) {
    return mantissa === 0 ? (signBit ? -Infinity : Infinity) : NaN
  }
  const finalExp = exponent - 15 + 127
  const finalMantissa = mantissa << 13
  const bits = (signBit << 31) | (finalExp << 23) | finalMantissa
  return new Float32Array(new Uint32Array([bits]).buffer)[0]
}
