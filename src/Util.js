/**
 *
 * @param url
 * @param onProgress
 * @returns {Promise<unknown>}
 */
export function requestData(url, onProgress) {
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
