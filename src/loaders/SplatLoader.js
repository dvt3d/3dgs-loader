import { parseSplatToColumns } from '../parsers/SplatParser'
import { requestData } from '../Util'
import Loader from './Loader'

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
  async parseColumns(data) {
    if (this._workerLimit > 0) {
      return await this._workerPool.run({
        type: 'parseColumns',
        payload: data,
        transfer: [data.buffer],
      })
    }
    return Promise.resolve(parseSplatToColumns(data))
  }

  /**
   *
   * @param path
   * @returns {Promise<void>}
   */
  async load(path, options = {}) {
    const { onProgress } = options
    return await requestData(path, onProgress)
  }
}

export default SplatLoader
