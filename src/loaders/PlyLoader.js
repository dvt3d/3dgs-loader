import { parsePlyToColumns, parsePlyToSplat } from '../parsers/PlyParser'
import { requestData } from '../Util'
import Loader from './Loader'

class PlyLoader extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'ply.worker.min.js',
    })
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  parseColumns(data) {
    if (this._workerLimit > 0) {
      return this._workerPool.run({
        type: 'parseColumns',
        payload: data,
        transfer: [data.buffer],
      })
    }
    return Promise.resolve(parsePlyToColumns(data))
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
    return Promise.resolve(parsePlyToSplat(data))
  }
}

export default PlyLoader
