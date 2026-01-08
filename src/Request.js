/**
 *
 * @param url
 * @param onProgress
 * @returns {Promise<unknown>}
 */
export function requestBuffer(url, onProgress) {
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
      const buffer = new Uint8Array(received)
      let offset = 0
      for (const c of chunks) {
        buffer.set(c, offset)
        offset += c.length
      }
      resolve(buffer)
    } catch (e) {
      reject(e)
    }
  })
}
