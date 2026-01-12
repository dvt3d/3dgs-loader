import { parseSpzToColumns, parseSpzToSplat } from '../parsers/SpzParser'
import { requestData } from '../Util'
import Loader from './Loader'

class SpzLoader extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'spz.worker.min.js',
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
    return Promise.resolve(parseSpzToColumns(data))
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<*>}
   */
  async loadAsSplat(url, options = {}) {
    const { onProgress } = options
    const data = await requestData(url, onProgress)
    return this.parseAsSplat(data)
  }

  /**
   *
   * @param data
   * @returns {Promise<*>}
   */
  parseAsSplat(data) {
    if (this._workerLimit > 0) {
      return this._workerPool.run({
        type: 'parseAsSplat',
        payload: data,
        transfer: [data.buffer],
      })
    }
    return Promise.resolve(parseSpzToSplat(data))
  }
}

export default SpzLoader
