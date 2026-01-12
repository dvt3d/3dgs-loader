import { parseSplatToColumns } from '../parsers/SplatParser'
import { requestData } from '../Util'
import Loader from './Loader'

const ROW_LENGTH = 3 * 4 + 3 * 4 + 4 + 4

class SplatLoader extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'splat.worker.min.js',
    })
  }

  /**
   *
   * @param data
   * @returns {Promise<Awaited<{numSplats: *, columns: {x: Float32Array<ArrayBuffer>, y: Float32Array<ArrayBuffer>, z: Float32Array<ArrayBuffer>, scale_0: Float32Array<ArrayBuffer>, scale_1: Float32Array<ArrayBuffer>, scale_2: Float32Array<ArrayBuffer>, f_dc_0: Float32Array<ArrayBuffer>, f_dc_1: Float32Array<ArrayBuffer>, f_dc_2: Float32Array<ArrayBuffer>, opacity: Float32Array<ArrayBuffer>, rot_0: Float32Array<ArrayBuffer>, rot_1: Float32Array<ArrayBuffer>, rot_2: Float32Array<ArrayBuffer>, rot_3: Float32Array<ArrayBuffer>}}>>|Promise<never>|Promise<*>|Promise<*>|*}
   */
  parseColumns(data) {
    if (this._workerLimit > 0) {
      return this._workerPool.run({
        type: 'parseColumns',
        payload: data,
        transfer: [data.buffer],
      })
    }
    return Promise.resolve(parseSplatToColumns(data))
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<{numSplats: number, buffer: *}>}
   */
  async load(url, options = {}) {
    const { onProgress } = options
    const data = await requestData(url, onProgress)
    const numSplats = data.length / ROW_LENGTH
    return {
      numSplats,
      buffer: data.buffer,
    }
  }
}

export default SplatLoader
