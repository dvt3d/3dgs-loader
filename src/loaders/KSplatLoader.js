import { requestData } from '../Util'
import Loader from './Loader'
import {
  parseKSplatToColumns,
  parseKSplatToSplat,
} from '../parsers/KSplatParser'

class KSplatLoader extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'k-splat.worker.min.js',
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
    return Promise.resolve(parseKSplatToColumns(data))
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
    return Promise.resolve(parseKSplatToSplat(data))
  }
}

export default KSplatLoader
