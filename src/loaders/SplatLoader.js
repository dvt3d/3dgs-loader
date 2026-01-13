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
   * @returns {Promise<*>}
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
   * @returns {Promise<*>}
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
