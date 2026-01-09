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
  async parseColumns(data) {
    if (this._workerLimit > 0) {
      return await this._workerPool.run({
        type: 'parseColumns',
        payload: data,
        transfer: [data.buffer],
      })
    }
    return Promise.resolve(parseSpzToColumns(data))
  }

  /**
   *
   * @param path
   * @returns {Promise<void>}
   */
  async loadAsSplat(path, options = {}) {
    const { onProgress } = options
    const data = await requestData(path, onProgress)
    return await this.parseAsSplat(data)
  }

  /**
   *
   * @param data
   * @returns {Promise<*>}
   */
  async parseAsSplat(data) {
    if (this._workerLimit > 0) {
      return await this._workerPool.run({
        type: 'parseAsSplat',
        payload: data,
        transfer: [data.buffer],
      })
    }
    return Promise.resolve(parseSpzToSplat(data))
  }
}

export default SpzLoader
